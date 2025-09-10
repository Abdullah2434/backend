import { Router, Request, Response } from 'express'
import * as ctrl from '../../controllers/video.controller'
import { authenticate } from '../../middleware'

const router = Router()

// PROTECTED ROUTES (authentication required)
router.get('/gallery', authenticate(), ctrl.gallery)
router.post('/delete', authenticate(), ctrl.deleteVideo)
router.get('/download-proxy', authenticate(), ctrl.downloadProxy)
router.get('/avatars', authenticate(), ctrl.getAvatars)
router.get('/voices', authenticate(), ctrl.getVoices)
router.post('/photo-avatar', authenticate(), ctrl.createPhotoAvatarUpload, ctrl.createPhotoAvatar)

// PUBLIC ROUTES (no authentication required)
router.post('/download', ctrl.download)
router.post('/status', ctrl.updateStatus)

// PUBLIC ROUTE: Video creation via webhook
router.post('/create', ctrl.createVideo);
router.post('/generate-video', ctrl.generateVideo);

export default router


