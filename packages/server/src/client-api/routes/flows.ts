import express from 'express'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { requireClientPermission } from '../middleware/workspace'

const router = express.Router()

router.get('/', requireClientPermission('chatflows:view'), async (req, res, next) => {
    try {
        const items = await getRunningExpressApp()
            .AppDataSource.getRepository(ChatFlow)
            .createQueryBuilder('chatflow')
            .select([
                'chatflow.id',
                'chatflow.name',
                'chatflow.type',
                'chatflow.category',
                'chatflow.deployed',
                'chatflow.isPublic',
                'chatflow.createdDate',
                'chatflow.updatedDate'
            ])
            .where('chatflow.workspaceId = :workspaceId', { workspaceId: req.clientPrincipal!.workspaceId })
            .orderBy('chatflow.updatedDate', 'DESC')
            .getMany()

        return res.json({ items })
    } catch (error) {
        return next(error)
    }
})

router.get('/:id', requireClientPermission('chatflows:view'), async (req, res, next) => {
    try {
        const chatflow = await getRunningExpressApp()
            .AppDataSource.getRepository(ChatFlow)
            .findOne({
                select: {
                    id: true,
                    name: true,
                    type: true,
                    category: true,
                    deployed: true,
                    isPublic: true,
                    chatbotConfig: true,
                    createdDate: true,
                    updatedDate: true,
                    workspaceId: true
                },
                where: {
                    id: req.params.id,
                    workspaceId: req.clientPrincipal!.workspaceId
                }
            })

        if (!chatflow) {
            return res.status(404).json({ error: { code: 'flow_not_found', message: 'Flow not found' } })
        }
        delete (chatflow as Partial<ChatFlow>).workspaceId
        return res.json(chatflow)
    } catch (error) {
        return next(error)
    }
})

export default router
