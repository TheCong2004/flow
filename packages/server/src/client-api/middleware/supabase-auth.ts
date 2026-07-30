import { createPublicKey, JsonWebKey, KeyObject } from 'crypto'
import { NextFunction, Request, Response } from 'express'
import jwt, { JwtHeader, JwtPayload, SigningKeyCallback } from 'jsonwebtoken'

type SupabaseJwk = JsonWebKey & {
    kid: string
    alg?: string
}

type CachedJwks = {
    expiresAt: number
    keys: SupabaseJwk[]
}

const JWKS_CACHE_MS = 10 * 60 * 1000
let cachedJwks: CachedJwks | undefined

function getSupabaseConfig() {
    const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
    if (!url) throw new Error('SUPABASE_URL is required when CLIENT_API_ENABLED=true')
    return { url, publishableKey }
}

async function fetchJwks(): Promise<SupabaseJwk[]> {
    const { url } = getSupabaseConfig()
    if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.keys

    const response = await fetch(`${url}/auth/v1/.well-known/jwks.json`)
    if (!response.ok) throw new Error(`Unable to load Supabase JWKS (${response.status})`)

    const body = (await response.json()) as { keys?: SupabaseJwk[] }
    const keys = Array.isArray(body.keys) ? body.keys : []
    cachedJwks = { keys, expiresAt: Date.now() + JWKS_CACHE_MS }
    return keys
}

async function verifyAsymmetricToken(token: string): Promise<JwtPayload> {
    const { url } = getSupabaseConfig()

    return await new Promise<JwtPayload>((resolve, reject) => {
        const getKey = async (header: JwtHeader, callback: SigningKeyCallback) => {
            try {
                if (!header.kid) return callback(new Error('JWT key id is missing'))
                const keys = await fetchJwks()
                const jwk = keys.find((candidate) => candidate.kid === header.kid)
                if (!jwk) return callback(new Error('JWT signing key not found'))
                callback(null, createPublicKey({ key: jwk, format: 'jwk' }) as KeyObject)
            } catch (error) {
                callback(error as Error)
            }
        }

        jwt.verify(
            token,
            getKey,
            {
                algorithms: ['RS256', 'ES256'],
                audience: 'authenticated',
                issuer: `${url}/auth/v1`
            },
            (error, decoded) => {
                if (error) return reject(error)
                if (!decoded || typeof decoded === 'string') return reject(new Error('Invalid JWT payload'))
                resolve(decoded)
            }
        )
    })
}

async function verifyLegacyToken(token: string): Promise<JwtPayload> {
    const { url, publishableKey } = getSupabaseConfig()
    if (!publishableKey) throw new Error('SUPABASE_PUBLISHABLE_KEY is required for legacy Supabase JWT verification')

    const response = await fetch(`${url}/auth/v1/user`, {
        headers: {
            apikey: publishableKey,
            Authorization: `Bearer ${token}`
        }
    })
    if (!response.ok) throw new Error('Invalid or expired Supabase access token')

    const user = (await response.json()) as { id?: string; email?: string }
    if (!user.id) throw new Error('Supabase user id is missing')
    return { sub: user.id, email: user.email, aud: 'authenticated', iss: `${url}/auth/v1` }
}

export async function verifySupabaseAccessToken(token: string): Promise<JwtPayload> {
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded || typeof decoded === 'string') throw new Error('Malformed access token')
    const algorithm = decoded.header.alg
    if (algorithm === 'HS256') return verifyLegacyToken(token)
    if (algorithm !== 'RS256' && algorithm !== 'ES256') throw new Error(`Unsupported JWT algorithm: ${algorithm}`)
    return verifyAsymmetricToken(token)
}

export async function requireSupabaseUser(req: Request, res: Response, next: NextFunction) {
    try {
        const authorization = req.header('authorization')
        if (!authorization?.startsWith('Bearer ')) {
            return res.status(401).json({
                error: { code: 'missing_access_token', message: 'Authorization Bearer token is required' }
            })
        }

        const payload = await verifySupabaseAccessToken(authorization.slice(7))
        if (!payload.sub) {
            return res.status(401).json({
                error: { code: 'invalid_access_token', message: 'JWT subject is missing' }
            })
        }

        req.clientPrincipal = {
            supabaseUserId: payload.sub,
            email: typeof payload.email === 'string' ? payload.email : undefined,
            workspaceId: '',
            permissions: []
        }
        return next()
    } catch {
        return res.status(401).json({
            error: { code: 'invalid_access_token', message: 'Access token is invalid or expired' }
        })
    }
}

export function clearSupabaseJwksCacheForTests() {
    cachedJwks = undefined
}
