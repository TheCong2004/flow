import 'reflect-metadata'
import path from 'path'
import * as fs from 'fs'
import { DataSource } from 'typeorm'
import { entitiesList } from './database/entities'
import { sqliteMigrations } from './database/migrations/sqlite'
import { mysqlMigrations } from './database/migrations/mysql'
import { mariadbMigrations } from './database/migrations/mariadb'
import { postgresMigrations } from './database/migrations/postgres'
import logger from './utils/logger'

const getUserHome = (): string => {
    const variableName = process.platform === 'win32' ? 'USERPROFILE' : 'HOME'
    return process.env[variableName] || process.cwd()
}

let appDataSource: DataSource

export const init = async (forceNoSSL = false): Promise<void> => {
    let homePath
    let flowisePath = path.join(getUserHome(), '.flowise')
    if (!fs.existsSync(flowisePath)) {
        fs.mkdirSync(flowisePath)
    }
    logger.info(`📦 [DataSource]: Initializing DB type: ${process.env.DATABASE_TYPE || 'sqlite (default)'}, forceNoSSL: ${forceNoSSL}`)
    switch (process.env.DATABASE_TYPE) {
        case 'sqlite':
            homePath = process.env.DATABASE_PATH ?? flowisePath
            appDataSource = new DataSource({
                type: 'sqlite',
                database: path.resolve(homePath, 'database.sqlite'),
                synchronize: false,
                migrationsRun: false,
                entities: entitiesList,
                migrations: sqliteMigrations
            })
            break
        case 'mysql':
            appDataSource = new DataSource({
                type: 'mysql',
                host: process.env.DATABASE_HOST,
                port: parseInt(process.env.DATABASE_PORT || '3306'),
                username: process.env.DATABASE_USER,
                password: process.env.DATABASE_PASSWORD,
                database: process.env.DATABASE_NAME,
                charset: 'utf8mb4',
                synchronize: false,
                migrationsRun: false,
                entities: entitiesList,
                migrations: mysqlMigrations,
                ssl: getDatabaseSSLFromEnv()
            })
            break
        case 'mariadb':
            appDataSource = new DataSource({
                type: 'mariadb',
                host: process.env.DATABASE_HOST,
                port: parseInt(process.env.DATABASE_PORT || '3306'),
                username: process.env.DATABASE_USER,
                password: process.env.DATABASE_PASSWORD,
                database: process.env.DATABASE_NAME,
                charset: 'utf8mb4',
                synchronize: false,
                migrationsRun: false,
                entities: entitiesList,
                migrations: mariadbMigrations,
                ssl: getDatabaseSSLFromEnv()
            })
            break
        case 'postgres': {
            const sslConfig = forceNoSSL ? false : getDatabaseSSLFromEnv()
            const postgresOptions: any = {
                type: 'postgres',
                ssl: sslConfig,
                synchronize: false,
                migrationsRun: false,
                entities: entitiesList,
                migrations: postgresMigrations,
                extra: {
                    idleTimeoutMillis: 120000,
                    ...(sslConfig ? { ssl: sslConfig } : { ssl: false })
                },
                logging: ['error', 'warn', 'info', 'log'],
                logger: 'advanced-console',
                logNotifications: true,
                poolErrorHandler: (err: any) => {
                    logger.error(`Database pool error: ${JSON.stringify(err)}`)
                },
                applicationName: 'Flowise'
            }

            if (process.env.DATABASE_URL) {
                postgresOptions.url = process.env.DATABASE_URL
            } else {
                const rawHost = process.env.DATABASE_HOST ? process.env.DATABASE_HOST.trim().split(':')[0] : 'localhost'
                postgresOptions.host = rawHost
                postgresOptions.port = parseInt(process.env.DATABASE_PORT || '5432')
                postgresOptions.username = process.env.DATABASE_USER
                postgresOptions.password = process.env.DATABASE_PASSWORD
                postgresOptions.database = process.env.DATABASE_NAME

                if (rawHost.includes('neon.tech') || rawHost.startsWith('ep-')) {
                    const endpointId = rawHost.split('.')[0]
                    postgresOptions.extra.options = `-c endpoint=${endpointId}`
                    logger.info(`🐘 [DataSource]: Detected Neon database host. Appended option: -c endpoint=${endpointId}`)
                }
            }

            appDataSource = new DataSource(postgresOptions)
            break
        }
        default:
            homePath = process.env.DATABASE_PATH ?? flowisePath
            appDataSource = new DataSource({
                type: 'sqlite',
                database: path.resolve(homePath, 'database.sqlite'),
                synchronize: false,
                migrationsRun: false,
                entities: entitiesList,
                migrations: sqliteMigrations
            })
            break
    }
}

export function getDataSource(): DataSource {
    if (appDataSource === undefined) {
        init()
    }
    return appDataSource
}

export const getDatabaseSSLFromEnv = () => {
    if (process.env.DATABASE_SSL === 'false' || process.env.DATABASE_SSL === '0') {
        return false
    }
    let host = process.env.DATABASE_HOST ? process.env.DATABASE_HOST.trim().split(':')[0] : undefined
    if (!host && process.env.DATABASE_URL) {
        try {
            const parsedUrl = new URL(process.env.DATABASE_URL)
            host = parsedUrl.hostname
        } catch (e) {
            // ignore
        }
    }
    const isExplicitSSL = process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1'
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || (host && host.endsWith('.local'))
    if (!isExplicitSSL && (isLocalHost || !host)) {
        return false
    }

    const isIP = host && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host)
    const sslConfig: any = {
        rejectUnauthorized: process.env.DATABASE_REJECT_UNAUTHORIZED === 'true'
    }
    if (host && !isIP) {
        sslConfig.servername = host
    }
    if (process.env.DATABASE_SSL_KEY_BASE64) {
        sslConfig.ca = Buffer.from(process.env.DATABASE_SSL_KEY_BASE64, 'base64')
    }
    return sslConfig
}



