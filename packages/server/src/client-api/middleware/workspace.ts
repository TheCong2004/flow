import { NextFunction, Request, Response } from 'express'
import { ExternalIdentity } from '../../database/entities/ExternalIdentity'
import { Role } from '../../enterprise/database/entities/role.entity'
import { User, UserStatus } from '../../enterprise/database/entities/user.entity'
import { WorkspaceUser, WorkspaceUserStatus } from '../../enterprise/database/entities/workspace-user.entity'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'

function parsePermissions(role?: Role): string[] {
    if (!role?.permissions) return []
    try {
        const parsed = JSON.parse(role.permissions)
        if (Array.isArray(parsed)) return parsed.filter((permission): permission is string => typeof permission === 'string')
    } catch {
        // Older installations can contain comma-separated permissions.
    }
    return role.permissions
        .split(',')
        .map((permission) => permission.trim())
        .filter(Boolean)
}

async function resolveFlowiseUserId(providerUserId: string, email?: string): Promise<string | undefined> {
    const dataSource = getRunningExpressApp().AppDataSource
    const identityRepository = dataSource.getRepository(ExternalIdentity)
    const existing = await identityRepository.findOneBy({ provider: 'supabase', providerUserId })
    if (existing) return existing.flowiseUserId

    if (process.env.CLIENT_API_AUTO_LINK_BY_EMAIL !== 'true' || !email) return undefined

    const user = await dataSource.getRepository(User).findOneBy({ email, status: UserStatus.ACTIVE })
    if (!user) return undefined

    try {
        await identityRepository.save(
            identityRepository.create({
                provider: 'supabase',
                providerUserId,
                flowiseUserId: user.id
            })
        )
    } catch {
        const concurrentlyCreated = await identityRepository.findOneBy({ provider: 'supabase', providerUserId })
        if (concurrentlyCreated) return concurrentlyCreated.flowiseUserId
        throw new Error('Unable to link Supabase identity')
    }
    return user.id
}

export async function requireWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
        const principal = req.clientPrincipal
        if (!principal) {
            return res.status(401).json({ error: { code: 'missing_principal', message: 'Authentication is required' } })
        }

        const workspaceId = req.header('x-workspace-id')
        if (!workspaceId) {
            return res.status(400).json({
                error: { code: 'missing_workspace', message: 'X-Workspace-Id header is required' }
            })
        }

        const flowiseUserId = await resolveFlowiseUserId(principal.supabaseUserId, principal.email)
        if (!flowiseUserId) {
            return res.status(403).json({
                error: { code: 'identity_not_linked', message: 'Supabase user is not linked to a Flowise user' }
            })
        }

        const membership = await getRunningExpressApp()
            .AppDataSource.getRepository(WorkspaceUser)
            .findOne({
                where: {
                    workspaceId,
                    userId: flowiseUserId,
                    status: WorkspaceUserStatus.ACTIVE
                },
                relations: { role: true, workspace: true }
            })

        if (!membership?.workspace || !membership.role) {
            return res.status(403).json({
                error: { code: 'workspace_forbidden', message: 'User does not have access to this workspace' }
            })
        }

        principal.flowiseUserId = flowiseUserId
        principal.workspaceId = membership.workspaceId
        principal.workspaceName = membership.workspace.name
        principal.organizationId = membership.workspace.organizationId
        principal.roleId = membership.roleId
        principal.roleName = membership.role.name
        principal.permissions = parsePermissions(membership.role)

        req.user = {
            id: flowiseUserId,
            email: principal.email ?? '',
            name: principal.email ?? flowiseUserId,
            roleId: membership.roleId,
            activeOrganizationId: membership.workspace.organizationId ?? '',
            activeOrganizationSubscriptionId: '',
            activeOrganizationCustomerId: '',
            activeOrganizationProductId: '',
            isOrganizationAdmin: membership.role.name === 'owner',
            activeWorkspaceId: membership.workspaceId,
            activeWorkspace: membership.workspace.name,
            assignedWorkspaces: [
                {
                    id: membership.workspace.id,
                    name: membership.workspace.name,
                    role: membership.role.name,
                    organizationId: membership.workspace.organizationId ?? ''
                }
            ],
            permissions: principal.permissions,
            features: {}
        }
        return next()
    } catch (error) {
        return next(error)
    }
}

export function requireClientPermission(permission: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const permissions = req.clientPrincipal?.permissions ?? []
        if (!permissions.includes(permission)) {
            return res.status(403).json({
                error: { code: 'permission_forbidden', message: `Required permission: ${permission}` }
            })
        }
        return next()
    }
}
