import { Router } from 'express';
import {
    uploadMedia,
    getUserMedia,
    getMediaById,
    updateMediaStatus,
    createSocialPost
} from '../../controllers/socialbu/socialbu-media.controller';

const router = Router();

// Media upload routes
router.post('/upload', uploadMedia as any); // Upload media to SocialBu
router.post('/create-post', createSocialPost as any); // Create social media post with complete workflow
router.get('/user-media', getUserMedia as any); // Get user's media uploads
router.get('/:mediaId', getMediaById as any); // Get specific media by ID
router.put('/:mediaId/status', updateMediaStatus as any); // Update media status

export default router;