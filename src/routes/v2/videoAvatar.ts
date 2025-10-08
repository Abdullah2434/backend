import { Router } from 'express';
import * as ctrl from '../../controllers/videoAvatar.controller';

const router = Router();

// Video Avatar API Routes (v2)
// These routes follow the API specification provided

// POST /v2/video_avatar - Submit Video Avatar Creation Request (with file upload support)
router.post('/video_avatar', ctrl.uploadMiddleware, ctrl.createVideoAvatar);

// GET /v2/video_avatar/:id - Check Video Avatar Generation Status
router.get('/video_avatar/:id', ctrl.getVideoAvatarStatus);

// GET /v2/video_avatar/group/:groupId - Get all avatars by group ID (bonus endpoint)
router.get('/video_avatar/group/:groupId', ctrl.getAvatarsByGroup);

// DELETE /v2/video_avatar/:id - Delete video avatar (bonus endpoint)
router.delete('/video_avatar/:id', ctrl.deleteVideoAvatar);

// GET /v2/video_avatar/health - Health check (bonus endpoint)
router.get('/video_avatar/health', ctrl.healthCheck);

export default router;
