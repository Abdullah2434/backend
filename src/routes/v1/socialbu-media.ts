import { Router } from 'express';
import {
    uploadMedia,
    getUserMedia,
    getMediaById,
    updateMediaStatus,
    createSocialPost
} from '../../controllers/socialbu-media.controller';

const router = Router();

// Media upload routes
router.post('/upload', uploadMedia); // Upload media to SocialBu
router.post('/create-post', createSocialPost); // Create social media post with complete workflow
router.get('/user-media', getUserMedia); // Get user's media uploads
router.get('/:mediaId', getMediaById); // Get specific media by ID
router.put('/:mediaId/status', updateMediaStatus); // Update media status

export default router;