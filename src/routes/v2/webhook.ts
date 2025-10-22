import { Router } from 'express';
import * as ctrl from '../../controllers/webhook.controller';

const router = Router();

// Custom Webhook API Routes (v2)
// These routes provide webhook functionality with user authentication

// POST /v2/webhook/avatar - Custom avatar webhook endpoint
router.post('/webhook/avatar', ctrl.avatarWebhook);

// POST /v2/webhook/test - Test webhook functionality
router.post('/webhook/test', ctrl.testWebhook);

// POST /v2/webhook/verify - Verify webhook signature
router.post('/webhook/verify', ctrl.verifyWebhook);

// GET /v2/webhook/status - Get webhook service status
router.get('/webhook/status', ctrl.getWebhookStatus);

export default router;
