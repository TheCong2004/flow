import { FlowiseClientError, toClientError } from './errors'
import { parseSseStream } from './sse'
import { ClientPrincipal, FlowDetail, FlowiseClientOptions, FlowSummary, PredictionInput, PredictionResponse, SseEvent } from './types'

export class FlowiseClient {
    private readonly baseUrl: string
    private readonly fetcher: typeof globalThis.fetch
    private readonly timeoutMs: number

    constructor(private readonly options: FlowiseClientOptions) {
        this.baseUrl = options.baseUrl.replace(/\/$/, '')
        this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis)
        this.timeoutMs = options.timeoutMs ?? 60_000
    }

    private async headers(contentType = true): Promise<Headers> {
        const [token, workspaceId] = await Promise.all([this.options.getAccessToken(), this.options.getWorkspaceId()])
        if (!token) throw new FlowiseClientError('Authentication is required', 401, 'missing_access_token')
        if (!workspaceId) throw new FlowiseClientError('Active workspace is required', 400, 'missing_workspace')

        const headers = new Headers({
            Authorization: `Bearer ${token}`,
            'X-Workspace-Id': workspaceId
        })
        if (contentType) headers.set('Content-Type', 'application/json')
        return headers
    }

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), this.timeoutMs)
        const abort = () => controller.abort(init.signal?.reason)
        init.signal?.addEventListener('abort', abort, { once: true })

        try {
            const response = await this.fetcher(`${this.baseUrl}${path}`, {
                ...init,
                headers: init.headers ?? (await this.headers()),
                signal: controller.signal
            })
            if (!response.ok) throw await toClientError(response)
            return (await response.json()) as T
        } finally {
            clearTimeout(timeout)
            init.signal?.removeEventListener('abort', abort)
        }
    }

    readonly me = {
        get: (): Promise<ClientPrincipal> => this.request('/api/client/v1/me')
    }

    readonly flows = {
        list: async (): Promise<FlowSummary[]> => {
            const response = await this.request<{ items: FlowSummary[] }>('/api/client/v1/flows')
            return response.items
        },
        get: (id: string): Promise<FlowDetail> => this.request(`/api/client/v1/flows/${encodeURIComponent(id)}`)
    }

    readonly predictions = {
        create: ({ flowId, ...input }: PredictionInput): Promise<PredictionResponse> =>
            this.request(`/api/client/v1/prediction/${encodeURIComponent(flowId)}`, {
                method: 'POST',
                body: JSON.stringify({ ...input, streaming: false })
            }),

        stream: async function* (this: FlowiseClient, { flowId, ...input }: PredictionInput, signal?: AbortSignal) {
            const response = await this.fetcher(`${this.baseUrl}/api/client/v1/prediction/${encodeURIComponent(flowId)}`, {
                method: 'POST',
                headers: await this.headers(),
                body: JSON.stringify({ ...input, streaming: true }),
                signal
            })
            if (!response.ok) throw await toClientError(response)
            if (!response.body) throw new FlowiseClientError('Streaming response body is unavailable', 502, 'stream_unavailable')

            for await (const event of parseSseStream(response.body)) yield event
        }.bind(this) as (input: PredictionInput, signal?: AbortSignal) => AsyncGenerator<SseEvent>
    }
}
