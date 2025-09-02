import { Router } from 'express'
import * as ctrl from '../../controllers/webhook.controller'

const router = Router()

router.post('/video-complete', ctrl.videoComplete)

export default router


