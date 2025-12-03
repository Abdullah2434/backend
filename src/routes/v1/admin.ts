import { Router } from "express";
import * as ctrl from "../../controllers/admin.controller";
import { authenticate, requireAdmin } from "../../middleware";

const router = Router();

// All admin routes require authentication and admin role
router.get("/users", authenticate(), requireAdmin(), ctrl.getAllUsers);
router.get("/user-avatar-videos", authenticate(), requireAdmin(), ctrl.getAllUserAvatarVideos);
router.get("/user-avatar-videos/:userId", authenticate(), requireAdmin(), ctrl.getUserAvatarVideos);
router.post(
  "/default-avatars",
  authenticate(),
  requireAdmin(),
  ctrl.uploadPreviewVideoMiddleware,
  ctrl.createDefaultAvatar
);

export default router;

