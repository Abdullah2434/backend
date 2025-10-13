import { Router } from 'express';
import {
  manualLogin,
  saveToken,
  getAccounts,
  getAccountsPublic,
  connectAccount,
  testConnection,
  testAuth,
  getPosts,
  getInsights
} from '../../controllers/socialbu.controller';

const router = Router();

// Token management routes
router.post('/login', manualLogin); // Manual login with env credentials
router.post('/save-token', saveToken); // Save token manually

// API routes
router.get('/accounts', getAccounts); // Get accounts from SocialBu (protected)
router.get('/accounts/public', getAccountsPublic); // Get accounts from SocialBu (public - uses shared token)
router.post('/accounts/connect', connectAccount); // Connect new account to SocialBu (public - uses shared token)
router.get('/posts', getPosts); // Get posts from SocialBu (protected)
router.get('/top/posts', getInsights); // Get insights from SocialBu (protected)
router.get('/test', testConnection); // Test API connection
router.get('/test-auth', testAuth); // Test authentication

export default router;
