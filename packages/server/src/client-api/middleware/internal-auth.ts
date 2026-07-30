import { NextFunction, Request, Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'

const MERCHANT_ISSUER = 'merchant-api'
const FLOWISE_AUDIENCE = 'flowise-internal'

function getInternalSecret(): string {
    const secret = process.env.MERCHANT_INTERNAL_JWT_SECRET
    if (!secret || secret.length < 32) throw new Error('MERCHANT_INTERNAL_JWT_SECRET must contain at least 32 characters')
    return secret
}

export function verifyMerchantToken(token: string): JwtPayload {
    const payload = jwt.verify(token, getInternalSecret(), {
        algorithms: ['HS256'],
        issuer: MERCHANT_ISSUER,
        audience: FLOWISE_AUDIENCE,
        clockTolerance: 5
    })
    if (typeof payload === 'string' || !payload.sub) throw new Error('Merchant token subject is missing')
    return payload
}

export function requireMerchantUser(req: Request, res: Response, next: NextFunction) {
    try {
        const authorization = req.header('authorization')
        if (!authorization?.startsWith('Bearer ')) {
            return res
                .status(401)
                .json({ error: { code: 'missing_internal_token', message: 'Merchant internal Bearer token is required' } })
        }
        const payload = verifyMerchantToken(authorization.slice(7))
        req.clientPrincipal = {
            supabaseUserId: payload.sub!,
            email: typeof payload.email === 'string' ? payload.email : undefined,
            workspaceId: '',
            permissions: []
        }
        return next()
    } catch {
        return res.status(401).json({ error: { code: 'invalid_internal_token', message: 'Merchant internal token is invalid or expired' } })
    }
}
