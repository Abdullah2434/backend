import { Router, Request, Response } from 'express'
import * as ctrl from '../../controllers/video.controller'
import { authenticate } from '../../middleware'

const router = Router()

// PROTECTED ROUTES (authentication required)
router.get('/gallery', ctrl.gallery)
router.post('/delete', ctrl.deleteVideo)
router.get('/download-proxy', ctrl.downloadProxy)
router.get('/avatars', ctrl.getAvatars)
router.get('/voices', ctrl.getVoices)
router.post('/photo-avatar', ctrl.createPhotoAvatarUpload, ctrl.createPhotoAvatar)

// PUBLIC ROUTES (no authentication required)
router.post('/download', ctrl.download)
router.post('/status', ctrl.updateStatus)

// PUBLIC ROUTE: Video creation via webhook
router.post('/create', ctrl.createVideo);
router.post('/generate-video', ctrl.generateVideo);

export default router


