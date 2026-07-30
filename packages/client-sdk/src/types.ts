export type MaybePromise<T> = T | Promise<T>

export type FlowiseClientOptions = {
    baseUrl: string
    getAccessToken: () => MaybePromise<string | null | undefined>
    getWorkspaceId: () => MaybePromise<string | null | undefined>
    fetch?: typeof globalThis.fetch
    timeoutMs?: number
}

export type ClientApiErrorBody = {
    error?: {
        code?: string
        message?: string
        details?: unknown
    }
}

export type ClientPrincipal = {
    userId: string
    flowiseUserId?: string
    email?: string
    workspace: {
        id: string
        name?: string
        organizationId?: string
    }
    role: {
        id?: string
        name?: string
        permissions: string[]
    }
}

export type FlowSummary = {
    id: string
    name: string
    type?: string
    category?: string
    deployed?: boolean
    isPublic?: boolean
    createdDate: string
    updatedDate: string
}

export type FlowDetail = FlowSummary & {
    chatbotConfig?: string
}

export type PredictionInput = {
    flowId: string
    question: string
    chatId?: string
    overrideConfig?: Record<string, unknown>
    history?: unknown[]
}

export type PredictionResponse = Record<string, unknown> & {
    text?: string
    chatId?: string
}

export type SseEvent<T = unknown> = {
    event: string
    data: T
    id?: string
    retry?: number
}
