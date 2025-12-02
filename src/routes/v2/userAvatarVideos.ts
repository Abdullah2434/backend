import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as ctrl from "../../controllers/userAvatarVideos.controller";

const router = Router();

// User avatar videos routes
router.post(
  "/user/avatar-videos",
  authenticate(),
  ctrl.uploadAvatarVideosMiddleware,
  ctrl.uploadAvatarVideos
);

router.get(
  "/user/avatar-videos",
  authenticate(),
  ctrl.getUserAvatarVideos
);

router.get(
  "/user/avatar-videos/:id",
  authenticate(),
  ctrl.getUserAvatarVideoById
);

export default router;

