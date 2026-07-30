import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { requireSupabaseUser } from './supabase-auth'

function responseMock() {
    const response = {
        status: jest.fn(),
        json: jest.fn()
    }
    response.status.mockReturnValue(response)
    response.json.mockReturnValue(response)
    return response as unknown as Response
}

describe('requireSupabaseUser', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        process.env.SUPABASE_URL = 'https://project.supabase.co'
        process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-key'
    })

    afterEach(() => {
        global.fetch = originalFetch
        jest.restoreAllMocks()
    })

    it('rejects requests without a bearer token', async () => {
        const request = { header: jest.fn().mockReturnValue(undefined) } as unknown as Request
        const response = responseMock()
        const next = jest.fn()

        await requireSupabaseUser(request, response, next)

        expect(response.status).toHaveBeenCalledWith(401)
        expect(next).not.toHaveBeenCalled()
    })

    it('verifies legacy HS256 tokens through the Supabase Auth user endpoint', async () => {
        const token = jwt.sign({ sub: 'supabase-user', email: 'user@example.com' }, 'legacy-secret', {
            algorithm: 'HS256'
        })
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ id: 'supabase-user', email: 'user@example.com' })
        }) as unknown as typeof fetch

        const request = {
            header: jest.fn().mockReturnValue(`Bearer ${token}`)
        } as unknown as Request
        const response = responseMock()
        const next = jest.fn()

        await requireSupabaseUser(request, response, next)

        expect(global.fetch).toHaveBeenCalledWith(
            'https://project.supabase.co/auth/v1/user',
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: `Bearer ${token}` })
            })
        )
        expect(request.clientPrincipal).toEqual({
            supabaseUserId: 'supabase-user',
            email: 'user@example.com',
            workspaceId: '',
            permissions: []
        })
        expect(next).toHaveBeenCalledTimes(1)
    })
})
