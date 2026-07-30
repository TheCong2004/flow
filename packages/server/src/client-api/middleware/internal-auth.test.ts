import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { requireMerchantUser } from './internal-auth'

function responseMock() {
    const response = { status: jest.fn(), json: jest.fn() }
    response.status.mockReturnValue(response)
    response.json.mockReturnValue(response)
    return response as unknown as Response
}

describe('requireMerchantUser', () => {
    const secret = 'merchant-flowise-shared-secret-at-least-32-chars'

    beforeEach(() => {
        process.env.MERCHANT_INTERNAL_JWT_SECRET = secret
    })

    afterEach(() => {
        delete process.env.MERCHANT_INTERNAL_JWT_SECRET
    })

    it('accepts a short-lived token issued by Merchant', () => {
        const token = jwt.sign({ sub: 'supabase-user', email: 'user@example.com' }, secret, {
            algorithm: 'HS256',
            issuer: 'merchant-api',
            audience: 'flowise-internal',
            expiresIn: 60
        })
        const request = { header: jest.fn().mockReturnValue(`Bearer ${token}`) } as unknown as Request
        const response = responseMock()
        const next = jest.fn()

        requireMerchantUser(request, response, next)

        expect(request.clientPrincipal).toEqual({
            supabaseUserId: 'supabase-user',
            email: 'user@example.com',
            workspaceId: '',
            permissions: []
        })
        expect(next).toHaveBeenCalledTimes(1)
    })

    it('rejects tokens signed with another secret', () => {
        const token = jwt.sign({ sub: 'supabase-user' }, 'different-secret-different-secret-123', {
            issuer: 'merchant-api',
            audience: 'flowise-internal'
        })
        const request = { header: jest.fn().mockReturnValue(`Bearer ${token}`) } as unknown as Request
        const response = responseMock()

        requireMerchantUser(request, response, jest.fn())

        expect(response.status).toHaveBeenCalledWith(401)
    })
})
