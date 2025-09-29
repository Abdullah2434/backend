import { Router } from 'express';
import {
  testWebhook,
  handleSocialBuWebhook,
  getUserSocialBuAccounts,
  removeUserSocialBuAccount
} from '../../controllers/webhook.controller';

const router = Router();

// Webhook routes
router.post('/test', testWebhook); // Test webhook endpoint
router.post('/socialbu', handleSocialBuWebhook); // Handle SocialBu account webhooks

// User SocialBu account management routes
router.get('/users/:userId/socialbu-accounts', getUserSocialBuAccounts); // Get user's SocialBu accounts
router.delete('/users/:userId/socialbu-accounts', removeUserSocialBuAccount); // Remove SocialBu account from user

export default router;