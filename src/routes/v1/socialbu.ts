import { Router } from "express";
import {
  manualLogin,
  saveToken,
  getAccounts,
  getAccountsPublic,
  connectAccount,
  testConnection,
  testAuth,
  getPosts,
  getInsights,
  getScheduledPosts,
} from "../../controllers/socialbu/socialbu.controller";

const router = Router();

// Token management routes
router.post("/login", manualLogin); // Manual login with env credentials
router.post("/save-token", saveToken); // Save token manually

// API routes
router.get("/accounts", getAccounts as any); // Get accounts from SocialBu (protected)
router.get("/accounts/public", getAccountsPublic as any); // Get accounts from SocialBu (public - uses shared token)
router.post("/accounts/connect", connectAccount as any); // Connect new account to SocialBu (public - uses shared token)
router.post("/posts", getPosts as any); // Get posts from SocialBu (protected)
router.post("/top/posts", getInsights as any); // Get insights from SocialBu (protected)
router.post("/posts/scheduled", getScheduledPosts as any); // Get scheduled posts from SocialBu (authenticated)
router.get("/test", testConnection as any); // Test API connection
router.get("/test-auth", testAuth as any); // Test authentication

export default router;
