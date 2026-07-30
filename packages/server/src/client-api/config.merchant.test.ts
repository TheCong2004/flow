import { validateClientApiConfig } from './config'

describe('Merchant Client API configuration', () => {
    afterEach(() => {
        delete process.env.CLIENT_API_ENABLED
        delete process.env.CLIENT_API_AUTH_MODE
        delete process.env.MERCHANT_INTERNAL_JWT_SECRET
        delete process.env.CLIENT_ALLOWED_ORIGINS
        delete process.env.SUPABASE_URL
    })

    it('does not require Supabase Auth configuration in merchant mode', () => {
        process.env.CLIENT_API_ENABLED = 'true'
        process.env.CLIENT_API_AUTH_MODE = 'merchant'
        process.env.MERCHANT_INTERNAL_JWT_SECRET = 'merchant-flowise-shared-secret-at-least-32-chars'
        process.env.CLIENT_ALLOWED_ORIGINS = 'https://app.example.com'

        expect(() => validateClientApiConfig()).not.toThrow()
    })

    it('rejects a weak Merchant shared secret', () => {
        process.env.CLIENT_API_ENABLED = 'true'
        process.env.CLIENT_API_AUTH_MODE = 'merchant'
        process.env.MERCHANT_INTERNAL_JWT_SECRET = 'too-short'
        process.env.CLIENT_ALLOWED_ORIGINS = 'https://app.example.com'

        expect(() => validateClientApiConfig()).toThrow('at least 32 characters')
    })
})
