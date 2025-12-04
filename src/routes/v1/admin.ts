import { Router } from "express";
import * as ctrl from "../../controllers/admin.controller";
import { authenticate, requireAdmin } from "../../middleware";

const router = Router();

// All admin routes require authentication and admin role
router.get("/users", authenticate() as any, requireAdmin() as any, ctrl.getAllUsers as any);
router.get("/user-avatar-videos", authenticate() as any, requireAdmin() as any, ctrl.getAllUserAvatarVideos as any);
router.get("/user-avatar-videos/:userId", authenticate() as any, requireAdmin() as any, ctrl.getUserAvatarVideos as any);
router.post(
  "/default-avatars",
  authenticate() as any,
  requireAdmin() as any,
  ctrl.uploadPreviewVideoMiddleware as any,
  ctrl.createDefaultAvatar as any
);

export default router;

