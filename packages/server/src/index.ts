import 'reflect-metadata'
import { ExpressAdapter } from '@bull-board/express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { Request, Response } from 'express'
import 'global-agent/bootstrap'
import http from 'http'
import path from 'path'
import fs from 'fs'
import { DataSource } from 'typeorm'
import { AbortControllerPool } from './AbortControllerPool'
import { CachePool } from './CachePool'
import { ChatFlow } from './database/entities/ChatFlow'
import { getDataSource } from './DataSource'
import { Organization } from './enterprise/database/entities/organization.entity'
import { Workspace } from './enterprise/database/entities/workspace.entity'
import { LoggedInUser } from './enterprise/Interface.Enterprise'
import { initializeJwtCookieMiddleware, verifyToken, verifyTokenForBullMQDashboard } from './enterprise/middleware/passport'
import { initAuthSecrets } from './enterprise/utils/authSecrets'
import { IdentityManager } from './IdentityManager'
import { MODE, Platform } from './Interface'
import { IMetricsProvider } from './Interface.Metrics'
import { OpenTelemetry } from './metrics/OpenTelemetry'
import { Prometheus } from './metrics/Prometheus'
import errorHandlerMiddleware from './middlewares/errors'
import { NodesPool } from './NodesPool'
import { QueueManager } from './queue/QueueManager'
import { ScheduleBeat } from './schedule/ScheduleBeat'
import { RedisEventSubscriber } from './queue/RedisEventSubscriber'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { spawn } from 'child_process'
import { Credential } from './database/entities/Credential'
import { initWebhookListenerRegistry } from './services/webhook-listener'
import flowiseApiV1Router from './routes'
import clientApiRouter from './client-api/routes'
import { validateClientApiConfig } from './client-api/config'
import { UsageCacheManager } from './UsageCacheManager'
import { getEncryptionKey, getNodeModulesPackagePath, transformToCredentialEntity } from './utils'
import { API_KEY_BLACKLIST_URLS, WHITELIST_URLS } from './utils/constants'
import logger, { expressRequestLogger } from './utils/logger'
import { RateLimiterManager } from './utils/rateLimit'
import { SSEStreamer } from './utils/SSEStreamer'
import { Telemetry } from './utils/telemetry'
import { validateAPIKey } from './utils/validateKey'
import { getCorsOptions, getIframeSecurityHeaders, sanitizeMiddleware, validateCorsConfig } from './utils/XSS'

declare global {
    namespace Express {
        interface User extends LoggedInUser {}
        interface Request {
            user?: LoggedInUser
        }
        namespace Multer {
            interface File {
                bucket: string
                key: string
                acl: string
                contentType: string
                contentDisposition: null
                storageClass: string
                serverSideEncryption: null
                metadata: any
                location: string
                etag: string
            }
        }
    }
}

export class App {
    app: express.Application
    nodesPool: NodesPool
    abortControllerPool: AbortControllerPool
    cachePool: CachePool
    telemetry: Telemetry
    rateLimiterManager: RateLimiterManager
    AppDataSource: DataSource = getDataSource()
    sseStreamer: SSEStreamer
    identityManager: IdentityManager
    metricsProvider: IMetricsProvider
    queueManager: QueueManager
    redisSubscriber: RedisEventSubscriber
    usageCacheManager: UsageCacheManager
    sessionStore: any
    constructor() {
        this.app = express()
        this.identityManager = new IdentityManager()
        this.nodesPool = new NodesPool()
        this.abortControllerPool = new AbortControllerPool()
        this.cachePool = new CachePool()
        this.telemetry = new Telemetry()
        this.sseStreamer = new SSEStreamer()
        this.rateLimiterManager = RateLimiterManager.getInstance()
    }

    async initDatabase() {
        // Initialize auth secrets (env → AWS Secrets Manager → filesystem)
        try {
            await initAuthSecrets()
            logger.info('🔐 [server]: Auth initialized successfully')
        } catch (err) {
            logger.error('❌ [server]: Error initializing auth secrets:', err)
        }

        try {
            // Initialize database
            let dbRetries = 5
            while (dbRetries > 0) {
                try {
                    if (!this.AppDataSource.isInitialized) {
                        await this.AppDataSource.initialize()
                        logger.info('📦 [server]: Data Source initialized successfully')
                    }
                    // Run Migrations Scripts
                    await this.AppDataSource.runMigrations({ transaction: 'each' })
                    logger.info('🔄 [server]: Database migrations completed successfully')

                    // Initialize Identity Manager
                    this.identityManager = await IdentityManager.getInstance()
                    logger.info('🔐 [server]: Identity Manager initialized successfully')
                    break
                } catch (err: any) {
                    dbRetries--
                    logger.error(`❌ [server]: Error during Data Source initialization (${dbRetries} retries left):`, err?.stack || err)
                    if (dbRetries === 0) {
                        logger.error('❌ [server]: Database initialization failed completely after 5 retries.')
                    } else {
                        await new Promise((resolve) => setTimeout(resolve, 3000))
                    }
                }
            }

            // Initialize nodes pool
            this.nodesPool = new NodesPool()
            await this.nodesPool.initialize()
            logger.info('🔧 [server]: Nodes pool initialized successfully')

            // Initialize abort controllers pool
            this.abortControllerPool = new AbortControllerPool()
            logger.info('⏹️ [server]: Abort controllers pool initialized successfully')

            // Initialize encryption key
            await getEncryptionKey()
            logger.info('🔑 [server]: Encryption key initialized successfully')

            // Initialize Rate Limit
            this.rateLimiterManager = RateLimiterManager.getInstance()
            await this.rateLimiterManager.initializeRateLimiters(await getDataSource().getRepository(ChatFlow).find())
            logger.info('🚦 [server]: Rate limiters initialized successfully')

            // Initialize cache pool
            this.cachePool = new CachePool()
            logger.info('💾 [server]: Cache pool initialized successfully')

            // Initialize usage cache manager
            this.usageCacheManager = await UsageCacheManager.getInstance()
            logger.info('📊 [server]: Usage cache manager initialized successfully')

            // Initialize telemetry
            this.telemetry = new Telemetry()
            logger.info('📈 [server]: Telemetry initialized successfully')

            // Initialize SSE Streamer
            this.sseStreamer = new SSEStreamer()
            this.sseStreamer.startHeartbeat()
            logger.info('🌊 [server]: SSE Streamer initialized successfully')

            // Init Queues
            if (process.env.MODE === MODE.QUEUE) {
                this.queueManager = QueueManager.getInstance()
                const serverAdapter = new ExpressAdapter()
                serverAdapter.setBasePath('/admin/queues')
                this.queueManager.setupAllQueues({
                    componentNodes: this.nodesPool.componentNodes,
                    telemetry: this.telemetry,
                    cachePool: this.cachePool,
                    appDataSource: this.AppDataSource,
                    abortControllerPool: this.abortControllerPool,
                    usageCacheManager: this.usageCacheManager,
                    identityManager: this.identityManager,
                    serverAdapter
                })
                logger.info('✅ [Queue]: All queues setup successfully')

                this.redisSubscriber = new RedisEventSubscriber(this.sseStreamer)
                await this.redisSubscriber.connect()
                this.redisSubscriber.startPeriodicCleanup()
                logger.info('🔗 [server]: Redis event subscriber connected successfully')
            }

            await initWebhookListenerRegistry(this.sseStreamer, this.redisSubscriber)
            logger.info('📡 [server]: Webhook listener registry initialized successfully')

            // Init ScheduleBeat (works in both queue and non-queue mode)
            await ScheduleBeat.getInstance().init()
            logger.info('⏰ [server]: ScheduleBeat initialized successfully')

            // Init Built-in FreeLLMAPI Service & Seed Credential
            if (process.env.HEADLESS_MODE !== 'true') {
                await this.ensureFreeLLMAPIStarted()
                await this.seedFreeLLMAPICredential()
            } else {
                logger.info('🪶 [server]: Headless mode enabled; FreeLLMAPI startup skipped')
            }

            logger.info('🎉 [server]: All initialization steps completed successfully!')
        } catch (error) {
            logger.error('❌ [server]: Error during Data Source initialization:', error)
        }
    }

    async config() {
        // Limit is needed to allow sending/receiving base64 encoded string
        const flowise_file_size_limit = process.env.FLOWISE_FILE_SIZE_LIMIT || '50mb'

        // Preserve raw bytes before JSON parsing for webhook HMAC signature verification
        const captureRawBody = (req: Request, _res: Response, buf: Buffer) => {
            ;(req as any).rawBody = buf
        }
        this.app.use(express.json({ limit: flowise_file_size_limit, verify: captureRawBody }))
        this.app.use(express.urlencoded({ limit: flowise_file_size_limit, extended: true, verify: captureRawBody }))

        // Enhanced trust proxy settings for load balancer
        let trustProxy: string | boolean | number | undefined = process.env.TRUST_PROXY
        if (typeof trustProxy === 'undefined' || trustProxy.trim() === '' || trustProxy === 'true') {
            trustProxy = true
        } else if (trustProxy === 'false') {
            trustProxy = false
        } else if (!isNaN(Number(trustProxy))) {
            trustProxy = Number(trustProxy)
        }

        this.app.set('trust proxy', trustProxy)

        // Allow access from specified domains
        validateCorsConfig()
        this.app.use(cors(getCorsOptions()))

        // Parse cookies
        this.app.use(cookieParser())

        // Allow embedding from specified domains.
        const iframeSecurityHeaders = getIframeSecurityHeaders()
        this.app.use((req, res, next) => {
            for (const [headerName, headerValue] of Object.entries(iframeSecurityHeaders)) {
                res.setHeader(headerName, headerValue)
            }
            next()
        })

        // Switch off the default 'X-Powered-By: Express' header
        this.app.disable('x-powered-by')

        // Internal Proxy to built-in FreeLLMAPI service
        this.app.use(
            '/freellmapi-app',
            createProxyMiddleware({
                target: 'http://127.0.0.1:3001',
                changeOrigin: true,
                pathRewrite: { '^/freellmapi-app': '' },
                on: {
                    proxyRes: (proxyRes: any) => {
                        delete proxyRes.headers['x-frame-options']
                        delete proxyRes.headers['frame-options']
                        delete proxyRes.headers['content-security-policy']
                    }
                }
            })
        )

        // Serve Infinite Canvas static build
        const infiniteCanvasBuildPath = path.resolve(__dirname, '../../../dist/infinite-canvas')
        this.app.use('/infinite-canvas-app', express.static(infiniteCanvasBuildPath))
        this.app.get(['/infinite-canvas-app', '/infinite-canvas-app/*'], (_req: Request, res: Response) => {
            res.sendFile(path.join(infiniteCanvasBuildPath, 'index.html'))
        })
        logger.info('🎨 [server]: Infinite Canvas route registered')

        // Add the expressRequestLogger middleware to log all requests
        this.app.use(expressRequestLogger)

        // Add the sanitizeMiddleware to guard against XSS
        this.app.use(sanitizeMiddleware)

        const denylistURLs = process.env.DENYLIST_URLS ? process.env.DENYLIST_URLS.split(',') : []
        const whitelistURLs = WHITELIST_URLS.filter((url) => !denylistURLs.includes(url))
        const URL_CASE_INSENSITIVE_REGEX: RegExp = /\/api\/v1\//i
        const URL_CASE_SENSITIVE_REGEX: RegExp = /\/api\/v1\//

        try {
            await initializeJwtCookieMiddleware(this.app, this.identityManager)
        } catch (err) {
            logger.error('❌ [server]: Error initializing JWT cookie middleware:', err)
        }

        this.app.use(async (req, res, next) => {
            if (URL_CASE_INSENSITIVE_REGEX.test(req.path)) {
                if (URL_CASE_SENSITIVE_REGEX.test(req.path)) {
                    const isOpenSource = !this.identityManager || this.identityManager.isOpenSource()
                    const isAuthDisabled = isOpenSource && !process.env.FLOWISE_USERNAME && !process.env.FLOWISE_PASSWORD
                    if (isAuthDisabled) {
                        req.user = {
                            id: 'default',
                            activeWorkspaceId: 'default',
                            activeOrganizationId: 'default',
                            permissions: [],
                            features: {}
                        } as any
                        return next()
                    }
                    const isWhitelisted = whitelistURLs.some((url) => req.path.startsWith(url))
                    if (isWhitelisted) {
                        next()
                    } else if (req.headers['x-request-from'] === 'internal') {
                        verifyToken(req, res, next)
                    } else {
                        const isAPIKeyBlacklistedURLS = API_KEY_BLACKLIST_URLS.some((url) => req.path.startsWith(url))
                        if (isAPIKeyBlacklistedURLS) {
                            return res.status(401).json({ error: 'Unauthorized Access' })
                        }

                        if (this.identityManager?.getPlatformType() !== Platform.OPEN_SOURCE) {
                            if (!this.identityManager?.isLicenseValid()) {
                                return res.status(401).json({ error: 'Unauthorized Access' })
                            }
                        }

                        const { isValid, apiKey } = await validateAPIKey(req)
                        if (!isValid || !apiKey) {
                            return res.status(401).json({ error: 'Unauthorized Access' })
                        }

                        const workspace = await this.AppDataSource.getRepository(Workspace).findOne({
                            where: { id: apiKey.workspaceId }
                        })
                        if (!workspace) {
                            return res.status(401).json({ error: 'Unauthorized Access' })
                        }

                        const activeOrganizationId = workspace.organizationId as string
                        const org = await this.AppDataSource.getRepository(Organization).findOne({
                            where: { id: activeOrganizationId }
                        })
                        if (!org) {
                            return res.status(401).json({ error: 'Unauthorized Access' })
                        }
                        const subscriptionId = org.subscriptionId as string
                        const customerId = org.customerId as string
                        const features = await this.identityManager?.getFeaturesByPlan(subscriptionId)
                        const productId = await this.identityManager?.getProductIdFromSubscription(subscriptionId)
                        // @ts-ignore
                        req.user = {
                            permissions: apiKey.permissions,
                            features,
                            activeOrganizationId: activeOrganizationId,
                            activeOrganizationSubscriptionId: subscriptionId,
                            activeOrganizationCustomerId: customerId,
                            activeOrganizationProductId: productId,
                            isOrganizationAdmin: false,
                            activeWorkspaceId: workspace.id,
                            activeWorkspace: workspace.name
                        }
                        next()
                    }
                } else {
                    return res.status(401).json({ error: 'Unauthorized Access' })
                }
            } else {
                next()
            }
        })

        try {
            await this.identityManager?.initializeSSO(this.app)
        } catch (err) {
            logger.error('❌ [server]: Error initializing SSO:', err)
        }

        if (process.env.ENABLE_METRICS === 'true') {
            switch (process.env.METRICS_PROVIDER) {
                case 'prometheus':
                case undefined:
                    this.metricsProvider = new Prometheus(this.app)
                    break
                case 'open_telemetry':
                    this.metricsProvider = new OpenTelemetry(this.app)
                    break
            }
            if (this.metricsProvider) {
                await this.metricsProvider.initializeCounters()
                logger.info(`📊 [server]: Metrics Provider [${this.metricsProvider.getName()}] has been initialized!`)
            } else {
                logger.error(
                    "❌ [server]: Metrics collection is enabled, but failed to initialize provider (valid values are 'prometheus' or 'open_telemetry'."
                )
            }
        }

        validateClientApiConfig()
        this.app.use('/api/v1', flowiseApiV1Router)
        if (process.env.CLIENT_API_ENABLED === 'true') {
            this.app.use('/api/client/v1', clientApiRouter)
            logger.info('Client API enabled at /api/client/v1')
        }

        this.app.get('/api/v1/ip', (request, response) => {
            response.send({
                ip: request.ip,
                msg: 'Check returned IP address in the response.'
            })
        })

        // Serve UI static
        const packagePath = getNodeModulesPackagePath('flowise-ui')
        const uiBuildPath = path.join(packagePath, 'build')
        const uiHtmlPath = path.join(packagePath, 'build', 'index.html')

        logger.info(`🌐 [server]: Serving UI static files from ${uiBuildPath}`)

        this.app.use('/', express.static(uiBuildPath))

        // Serve React UI for non-API routes
        this.app.use((req: Request, res: Response) => {
            if (fs.existsSync(uiHtmlPath)) {
                res.sendFile(uiHtmlPath)
            } else {
                res.status(404).send('Flowise UI build files not found.')
            }
        })

        if (process.env.MODE === MODE.QUEUE && process.env.ENABLE_BULLMQ_DASHBOARD === 'true' && !this.identityManager.isCloud()) {
            const id = 'bullmq_admin_dashboard'
            await this.rateLimiterManager.addRateLimiter(
                id,
                60,
                100,
                process.env.ADMIN_RATE_LIMIT_MESSAGE || 'Too many requests to admin dashboard, please try again later.'
            )

            const rateLimiter = this.rateLimiterManager.getRateLimiterById(id)
            this.app.use('/admin/queues', rateLimiter, verifyTokenForBullMQDashboard, this.queueManager.getBullBoardRouter())
        }

        this.app.use(errorHandlerMiddleware)
    }

    async stopApp() {
        try {
            this.sseStreamer.stopHeartbeat()
            const removePromises: any[] = []
            removePromises.push(this.telemetry.flush())
            if (this.queueManager) {
                removePromises.push(this.redisSubscriber.disconnect())
            }
            await Promise.all(removePromises)
        } catch (e) {
            logger.error(`❌[server]: Flowise Server shut down error: ${e}`)
        }
    }

    async ensureFreeLLMAPIStarted(): Promise<void> {
        return new Promise<void>((resolve) => {
            const req = http.get(
                'http://127.0.0.1:3001/v1/models',
                {
                    headers: { Authorization: 'Bearer freellmapi-a7daef8636feb16c7f4779a36125fa86b3c906f4baca2165' }
                },
                (res) => {
                    if (res.statusCode === 200 || res.statusCode === 401) {
                        logger.info('🔗 [FreeLLMAPI]: Built-in FreeLLMAPI background service is running on port 3001')
                        resolve()
                    } else {
                        this.spawnFreeLLM(resolve)
                    }
                }
            )
            req.on('error', () => {
                this.spawnFreeLLM(resolve)
            })
        })
    }

    spawnFreeLLM(resolve: () => void) {
        try {
            logger.info('🚀 [FreeLLMAPI]: Auto-starting built-in FreeLLMAPI background service...')
            const freellmDir = path.resolve(__dirname, '../../../freellmapi')
            const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
            const child = spawn(npmCmd, ['run', 'dev', '-w', 'server'], {
                cwd: freellmDir,
                stdio: 'ignore',
                shell: true,
                detached: true
            })
            child.on('error', (err) => {
                logger.warn('⚠️ [FreeLLMAPI]: Error spawning FreeLLMAPI process:', err.message)
            })
            child.unref()
        } catch (err: any) {
            logger.warn('⚠️ [FreeLLMAPI]: Failed to spawn FreeLLMAPI:', err?.message)
        }
        setTimeout(() => resolve(), 3000)
    }

    async seedFreeLLMAPICredential(): Promise<void> {
        try {
            const credRepo = this.AppDataSource.getRepository(Credential)
            const existing = await credRepo.findOne({ where: { name: 'FreeLLMAPI (Built-in)' } })
            if (!existing) {
                const workspaces = await this.AppDataSource.getRepository(Workspace).find()
                for (const ws of workspaces) {
                    const cred = await transformToCredentialEntity({
                        name: 'FreeLLMAPI (Built-in)',
                        credentialName: 'openAIApi',
                        plainDataObj: {
                            openAIApiKey: 'freellmapi-a7daef8636feb16c7f4779a36125fa86b3c906f4baca2165',
                            basePath: 'http://localhost:3001/v1'
                        },
                        workspaceId: ws.id
                    })
                    await credRepo.save(cred)
                    logger.info(`✅ [FreeLLMAPI]: Built-in FreeLLMAPI Credential auto-created for workspace: ${ws.name || ws.id}`)
                }
            }
        } catch (err) {
            logger.error('❌ [FreeLLMAPI]: Error auto-seeding credential:', err)
        }
    }
}

let serverApp: App | undefined

export async function start(): Promise<void> {
    serverApp = new App()

    const host = '0.0.0.0'
    const port = 3000
    const server = http.createServer(serverApp.app)

    server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
            logger.warn(`⚠️ [server]: Port ${port} is currently busy, retrying listen in 1.5s...`)
            setTimeout(() => {
                server.close()
                server.listen(port, host)
            }, 1500)
        } else {
            logger.error(`❌ [server]: Server error:`, err)
        }
    })

    try {
        await serverApp.initDatabase()
        await serverApp.config()
    } catch (err) {
        logger.error('❌ [server]: Error during server initialization:', err)
    }

    server.listen(port, host, () => {
        logger.info(`⚡️ [server]: Flowise Server is listening at http://${host}:${port}`)
    })
}

export function getInstance(): App | undefined {
    return serverApp
}
