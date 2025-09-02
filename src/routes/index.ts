import { Router } from 'express'
import authRoutes from './v1/auth'
import videoRoutes from './v1/video'
import webhookRoutes from './v1/webhook'

const router = Router()

router.use('/auth', authRoutes)
router.use('/video', videoRoutes)
router.use('/webhook', webhookRoutes)

export default router


