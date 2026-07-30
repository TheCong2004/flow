export type ClientPrincipal = {
    supabaseUserId: string
    flowiseUserId?: string
    email?: string
    workspaceId: string
    workspaceName?: string
    organizationId?: string
    roleId?: string
    roleName?: string
    permissions: string[]
}

declare global {
    namespace Express {
        interface Request {
            clientPrincipal?: ClientPrincipal
        }
    }
}

export {}
