export function validateClientApiConfig(): void {
    if (process.env.CLIENT_API_ENABLED !== 'true') return

    const authMode = process.env.CLIENT_API_AUTH_MODE || 'supabase'
    if (authMode !== 'supabase' && authMode !== 'merchant') {
        throw new Error('CLIENT_API_AUTH_MODE must be either supabase or merchant')
    }

    if (authMode === 'merchant') {
        const secret = process.env.MERCHANT_INTERNAL_JWT_SECRET
        if (!secret || secret.length < 32) {
            throw new Error('MERCHANT_INTERNAL_JWT_SECRET must contain at least 32 characters when CLIENT_API_AUTH_MODE=merchant')
        }
    } else {
        const supabaseUrl = process.env.SUPABASE_URL?.trim()
        if (!supabaseUrl) throw new Error('SUPABASE_URL is required when CLIENT_API_ENABLED=true')

        let parsedUrl: URL
        try {
            parsedUrl = new URL(supabaseUrl)
        } catch {
            throw new Error('SUPABASE_URL must be a valid absolute URL')
        }

        const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'
        if (parsedUrl.protocol !== 'https:' && !isLocalhost) {
            throw new Error('SUPABASE_URL must use HTTPS outside local development')
        }
    }

    if (!process.env.CLIENT_ALLOWED_ORIGINS?.trim()) {
        throw new Error('CLIENT_ALLOWED_ORIGINS is required when CLIENT_API_ENABLED=true')
    }
    if (process.env.CLIENT_ALLOWED_ORIGINS.trim() === '*') {
        throw new Error('CLIENT_ALLOWED_ORIGINS must be an explicit allowlist, not *')
    }
}
