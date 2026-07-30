import { validateClientApiConfig } from './config'

describe('validateClientApiConfig', () => {
    afterEach(() => {
        delete process.env.CLIENT_API_ENABLED
        delete process.env.SUPABASE_URL
        delete process.env.CLIENT_ALLOWED_ORIGINS
    })

    it('does nothing while the Client API is disabled', () => {
        expect(() => validateClientApiConfig()).not.toThrow()
    })

    it('requires explicit HTTPS configuration in production', () => {
        process.env.CLIENT_API_ENABLED = 'true'
        process.env.SUPABASE_URL = 'http://project.supabase.co'
        process.env.CLIENT_ALLOWED_ORIGINS = '*'
        expect(() => validateClientApiConfig()).toThrow('HTTPS')
    })

    it('accepts an HTTPS Supabase URL and explicit origins', () => {
        process.env.CLIENT_API_ENABLED = 'true'
        process.env.SUPABASE_URL = 'https://project.supabase.co'
        process.env.CLIENT_ALLOWED_ORIGINS = 'https://app.example.com,chrome-extension://extension-id'
        expect(() => validateClientApiConfig()).not.toThrow()
    })
})
