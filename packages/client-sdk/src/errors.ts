import { ClientApiErrorBody } from './types'

export class FlowiseClientError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code = 'request_failed',
        public readonly details?: unknown
    ) {
        super(message)
        this.name = 'FlowiseClientError'
    }
}

export async function toClientError(response: Response): Promise<FlowiseClientError> {
    let body: ClientApiErrorBody | undefined
    try {
        body = (await response.json()) as ClientApiErrorBody
    } catch {
        // The server can return plain text for errors raised after an SSE response starts.
    }
    return new FlowiseClientError(
        body?.error?.message || response.statusText || `Request failed (${response.status})`,
        response.status,
        body?.error?.code,
        body?.error?.details
    )
}
