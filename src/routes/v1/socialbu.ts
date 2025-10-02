import { Router } from "express";
import {
  authController,
  accountController,
  mediaController,
  socialBuWebhookHandler,
} from "../../modules/socialbu";

const router = Router();

// ============================================
// Authentication & Token Management Routes
// ============================================

// Admin/Setup routes for token management
router.post("/auth/login", authController.manualLogin);
router.post("/auth/save-token", authController.saveToken);
router.get("/auth/test", authController.testAuth);

// ============================================
// Account Management Routes
// ============================================

// Get accounts (protected - user-specific)
router.get("/accounts", accountController.getAccounts);

// Get all accounts (public - uses shared token)
router.get("/accounts/public", accountController.getAccountsPublic);

// Connect new account (public - uses shared token)
router.post("/accounts/connect", accountController.connectAccount);

// Test API connection
router.get("/accounts/test", accountController.testConnection);

// Remove account from user
router.delete("/accounts/:accountId", async (req, res) => {
  const userId = req.user?.id;
  const { accountId } = req.params;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const result = await socialBuWebhookHandler.removeUserAccount(
    userId,
    accountId
  );
  res.json(result);
});

// Check if user has account
router.get("/accounts/:accountId/check", async (req, res) => {
  const userId = req.user?.id;
  const { accountId } = req.params;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const result = await socialBuWebhookHandler.checkUserHasAccount(
    userId,
    accountId
  );
  res.json(result);
});

// ============================================
// Media Management Routes
// ============================================

// Upload media to SocialBu
router.post("/media/upload", mediaController.uploadMedia);

// Get user's media uploads
router.get("/media/user", mediaController.getUserMedia);

// Get active uploads
router.get("/media/active", mediaController.getActiveUploads);

// Get specific media status
router.get("/media/:mediaId/status", mediaController.getUploadStatus);

export default router;
