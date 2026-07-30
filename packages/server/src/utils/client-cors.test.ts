jest.mock('./domainValidation', () => ({
    extractChatflowId: jest.fn(),
    isPublicChatflowRequest: jest.fn().mockReturnValue(false),
    isTTSGenerateRequest: jest.fn().mockReturnValue(false),
    validateChatflowDomain: jest.fn()
}))

jest.mock('./logger', () => ({
    __esModule: true,
    default: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}))

import { getAllowedCorsOrigins, getCorsOptions } from './XSS'

describe('Client API CORS origins', () => {
    afterEach(() => {
        delete process.env.CORS_ORIGINS
        delete process.env.CLIENT_ALLOWED_ORIGINS
        delete process.env.APP_URL
    })

    it('merges and deduplicates admin and client origins', () => {
        process.env.CORS_ORIGINS = 'https://admin.example.com,https://shared.example.com'
        process.env.CLIENT_ALLOWED_ORIGINS = 'https://app.example.com,https://shared.example.com'

        expect(getAllowedCorsOrigins()).toBe('https://admin.example.com,https://shared.example.com,https://app.example.com')
    })

    it('does not allow a client-only origin to call a session-issuing endpoint', async () => {
        process.env.CORS_ORIGINS = 'https://admin.example.com'
        process.env.CLIENT_ALLOWED_ORIGINS = 'https://app.example.com'
        process.env.APP_URL = 'https://admin.example.com'

        let options: any
        getCorsOptions()({ url: '/api/v1/auth/login' }, (_error: Error | null, value: any) => {
            options = value
        })

        const allowed = await new Promise<boolean>((resolve, reject) => {
            options.origin('https://app.example.com', (error: Error | null, value: boolean) => {
                if (error) reject(error)
                else resolve(value)
            })
        })
        expect(allowed).toBe(false)
    })
})
