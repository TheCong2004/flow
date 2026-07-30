import express from 'express'
import predictionsController from '../../controllers/predictions'
import { getMulterStorage } from '../../utils'
import { requireClientPermission } from '../middleware/workspace'

const router = express.Router()

router.post(
    '/:id',
    requireClientPermission('chatflows:view'),
    getMulterStorage().array('files'),
    predictionsController.getRateLimiterMiddleware,
    predictionsController.createPrediction
)

export default router
