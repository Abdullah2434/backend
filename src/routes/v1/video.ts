import { Router, Request, Response } from 'express'
import * as ctrl from '../../controllers/video.controller'

const router = Router()

// PROTECTED ROUTES (authentication required)
router.get('/gallery', ctrl.gallery)
router.post('/delete', ctrl.deleteVideo)
router.get('/download-proxy', ctrl.downloadProxy)
router.get('/avatars', ctrl.getAvatars)
router.get('/voices', ctrl.getVoices)
router.post('/photo-avatar', ctrl.createPhotoAvatarUpload as any, ctrl.createPhotoAvatar)
router.get('/pending-workflows/:userId', ctrl.checkPendingWorkflows)

// PUBLIC ROUTES (no authentication required)
router.post('/download', ctrl.download)
router.post('/status', ctrl.updateStatus)

// PUBLIC ROUTE: Video creation via webhook
router.post('/create', ctrl.createVideo);
router.post('/generate-video', ctrl.generateVideo);

// TOPIC ROUTES (public - no authentication required)
router.get('/topics', ctrl.getAllTopics);
router.get('/topics/id/:id', ctrl.getTopicById);
router.get('/topics/:topic', ctrl.getTopicByType);

// EXECUTION TRACKING ROUTE (public - no authentication required)
router.post('/track-execution', ctrl.trackExecution);

export default router


