import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as ctrl from "../../controllers/userAvatarVideos.controller";

const router = Router();

// User avatar videos routes
router.post(
  "/user/avatar-videos",
  authenticate() as any,
  ctrl.uploadAvatarVideosMiddleware as any,
  ctrl.uploadAvatarVideos as any
);

router.get(
  "/user/avatar-videos",
  authenticate() as any,
  ctrl.getUserAvatarVideos as any
);

router.get(
  "/user/avatar-videos/:id",
  authenticate() as any,
  ctrl.getUserAvatarVideoById as any
);

export default router;

