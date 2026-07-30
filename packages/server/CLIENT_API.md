# Flowise Client API

The Client API exposes a small authenticated surface for Next.js, Tauri 2, and
Manifest V3 extensions while leaving the existing Flowise admin API unchanged.

## Enable

Use `docker/cloud-run.env.example` as the deployment template. The required
settings are:

```env
CLIENT_API_ENABLED=true
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
CLIENT_ALLOWED_ORIGINS=https://app.example.com,http://tauri.localhost,chrome-extension://EXTENSION_ID
```

`SUPABASE_PUBLISHABLE_KEY` is used only when the Supabase project still issues
legacy HS256 tokens. Asymmetric tokens are verified locally from the project's
JWKS endpoint.

## Link identities

Client access requires a durable mapping from `auth.users.id` to the existing
Flowise `user.id`. After the PostgreSQL migration has run, create the mapping:

```sql
insert into external_identity
    (provider, "providerUserId", "flowiseUserId")
values
    ('supabase', 'SUPABASE_AUTH_USER_UUID', 'FLOWISE_USER_UUID');
```

For a trusted, single-tenant migration, `CLIENT_API_AUTO_LINK_BY_EMAIL=true`
links the first verified Supabase request to an existing active Flowise user
with the same email. Keep it disabled for normal production operation.

The mapped Flowise user must have an active row in `workspace_user`. Every
client request must send that workspace ID in `X-Workspace-Id`.

## Endpoints

```text
GET  /api/client/v1/me
GET  /api/client/v1/flows
GET  /api/client/v1/flows/:id
POST /api/client/v1/prediction/:id
```

All endpoints require:

```http
Authorization: Bearer SUPABASE_ACCESS_TOKEN
X-Workspace-Id: FLOWISE_WORKSPACE_UUID
```

Prediction accepts the existing Flowise request body. Set `"streaming": true`
and consume the response using Fetch streaming rather than `EventSource`, so
the Authorization header can be sent.

## Shared SDK

Build `packages/client-sdk` and consume `@flowiseai/client-sdk` from each
application:

```ts
const client = new FlowiseClient({
    baseUrl: 'https://flowise-api.example.com',
    getAccessToken: async () => {
        const { data } = await supabase.auth.getSession()
        return data.session?.access_token
    },
    getWorkspaceId: () => activeWorkspaceId
})

for await (const event of client.predictions.stream({
    flowId,
    question: 'Hello'
})) {
    // event.event and event.data contain the Flowise SSE payload.
}
```

## Cloud Run

Deploy the repository Dockerfile with:

-   1 minimum instance for predictable cold starts
-   2 GiB memory initially
-   concurrency 10 initially
-   request timeout appropriate for the longest synchronous flow
-   region close to the Supabase project

Use `/api/v1/ping` as the health endpoint. Store every secret in the cloud
secret manager and never expose database, S3, service-role, or Flowise
encryption keys to a browser, desktop bundle, or extension.
