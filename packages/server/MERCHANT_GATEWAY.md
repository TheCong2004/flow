# Merchant gateway

Production clients call Merchant, not Flowise directly:

`Next.js / Tauri / Plasmo -> Merchant /v1/ai/* -> Flowise /api/client/v1/*`

## Flowise

Set:

```env
CLIENT_API_ENABLED=true
CLIENT_API_AUTH_MODE=merchant
MERCHANT_INTERNAL_JWT_SECRET=<same-random-secret-with-at-least-32-characters>
CLIENT_ALLOWED_ORIGINS=https://merchant-api.example.com
```

Flowise validates the Merchant JWT, then resolves the Supabase user through
`ExternalIdentity` and verifies active Flowise workspace membership.

## Merchant

Set the public Flowise URL:

```bash
wrangler secret put FLOWISE_INTERNAL_URL
wrangler secret put FLOWISE_INTERNAL_JWT_SECRET
```

`FLOWISE_INTERNAL_JWT_SECRET` must match `MERCHANT_INTERNAL_JWT_SECRET` on
Flowise. Merchant accepts the user's Supabase Bearer token and
`X-Workspace-Id`, then replaces the public token with a 60-second internal JWT.

Public endpoints:

-   `GET /v1/ai/me`
-   `GET /v1/ai/flows`
-   `GET /v1/ai/flows/:id`
-   `POST /v1/ai/prediction/:id`

Prediction request and response bodies are streamed without buffering.
