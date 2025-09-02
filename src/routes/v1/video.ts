import { Router } from 'express'
import * as ctrl from '../../controllers/video.controller'
import { authenticate } from '../../middleware'

const router = Router()

// PROTECTED ROUTES (authentication required)
router.get('/gallery', authenticate(), ctrl.gallery)
router.post('/delete', authenticate(), ctrl.deleteVideo)
router.get('/download-proxy', authenticate(), ctrl.downloadProxy)

// PUBLIC ROUTES (no authentication required)
router.post('/download', ctrl.download)
router.post('/status', ctrl.updateStatus)

export default router


