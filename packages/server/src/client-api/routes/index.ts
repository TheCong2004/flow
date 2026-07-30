import express from 'express'
import { requireMerchantUser } from '../middleware/internal-auth'
import { requireSupabaseUser } from '../middleware/supabase-auth'
import { requireWorkspace } from '../middleware/workspace'
import flowsRouter from './flows'
import predictionRouter from './prediction'

const router = express.Router()

router.use((req, res, next) => {
    if (process.env.CLIENT_API_AUTH_MODE === 'merchant') return requireMerchantUser(req, res, next)
    return requireSupabaseUser(req, res, next)
})
router.use(requireWorkspace)

router.get('/me', (req, res) => {
    const principal = req.clientPrincipal!
    return res.json({
        userId: principal.supabaseUserId,
        flowiseUserId: principal.flowiseUserId,
        email: principal.email,
        workspace: {
            id: principal.workspaceId,
            name: principal.workspaceName,
            organizationId: principal.organizationId
        },
        role: {
            id: principal.roleId,
            name: principal.roleName,
            permissions: principal.permissions
        }
    })
})

router.use('/flows', flowsRouter)
router.use('/prediction', predictionRouter)

export default router
