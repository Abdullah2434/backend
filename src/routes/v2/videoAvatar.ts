import { Router } from 'express';
import * as ctrl from '../../controllers/videoAvatar.controller';
import { authenticate } from '../../modules/auth/middleware/auth';

const router = Router();

// Video Avatar API Routes (v2)
// These routes follow the API specification provided

// POST /v2/video_avatar - Submit Video Avatar Creation Request (with file upload support)
router.post('/video_avatar', authenticate(), ctrl.uploadMiddleware, ctrl.createVideoAvatar);

// GET /v2/video_avatar/:id - Check Video Avatar Generation Status
router.get('/video_avatar/:id', ctrl.getVideoAvatarStatus);


// GET /v2/video_avatar/health - Health check (bonus endpoint)
router.get('/video_avatar/health', ctrl.healthCheck);

// GET /v2/video_avatar/proxy/:s3Key - Proxy endpoint for clean video URLs
router.get('/video_avatar/proxy/:s3Key', ctrl.proxyVideoFile);

export default router;
