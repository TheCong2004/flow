import express from 'express'
import authController from '../../controllers/auth'
const router = express.Router()

// RBAC
router.all(['/sso-success'], authController.ssoSuccess)

router.all(['/:type', '/permissions/:type'], authController.getAllPermissions)

export default router
