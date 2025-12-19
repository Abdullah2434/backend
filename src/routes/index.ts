import { Router } from "express";
import authRoutes from "./v1/auth";
import videoRoutes from "./v1/video";
import webhookRoutes from "./v1/webhook";
import subscriptionRoutes from "./v1/subscription";
import paymentMethodsRoutes from "./v1/payment-methods";
import contactRoutes from "./v1/contact";
import trendsRoutes from "./v1/trends";
import socialbuRoutes from "./v1/socialbu";
import socialbuMediaRoutes from "./v1/socialbu-media";
import socialbuAccountRoutes from "./v1/socialbu-account";
import userSettingsRoutes from "./v1/user-settings";
import userConnectedAccountRoutes from "./v1/userConnectedAccount";
import videoScheduleRoutes from "./v1/videoSchedule";
import userAvatarVideosRoutes from "./v2/userAvatarVideos";
import videoAvatarRoutes from "./v2/videoAvatar";
import webhookV2Routes from "./v2/webhook";
import dynamicPostsRoutes from "./v2/dynamicPosts";
import scheduleRoutes from "./v1/schedule";
import cronHealthRoutes from "./v1/cronHealth";
import energyProfileRoutes from "./v1/energyProfile";
import musicRoutes from "./v1/music";
import elevenLabsRoutes from "./v1/elevenLabs";
import adminRoutes from "./v1/admin";
import audioDurationRoutes from "./v1/audioDuration";

const router = Router();


router.use("/auth", authRoutes);
router.use("/video", videoRoutes);
router.use("/subscription", subscriptionRoutes);
router.use("/payment-methods", paymentMethodsRoutes);
router.use("/contact", contactRoutes);
router.use("/trends", trendsRoutes);
router.use("/socialbu", socialbuRoutes);
router.use("/socialbu-media", socialbuMediaRoutes);
router.use("/socialbu-account", socialbuAccountRoutes);
router.use("/user-settings", userSettingsRoutes);
router.use("/user-connected-accounts", userConnectedAccountRoutes);
router.use("/video-schedule", videoScheduleRoutes);
router.use("/admin", adminRoutes);
router.use("/schedule", scheduleRoutes);
router.use("/cron", cronHealthRoutes);
router.use("/energy-profile", energyProfileRoutes);
router.use("/music", musicRoutes);
router.use("/elevenlabs", elevenLabsRoutes);
router.use("/audio", audioDurationRoutes);
router.use("/webhook", webhookRoutes);

// V2 routes mounted without v2 prefix (for backward compatibility)
router.use("/", userAvatarVideosRoutes);
router.use("/", videoAvatarRoutes);
router.use("/", webhookV2Routes);
router.use("/dynamic-posts", dynamicPostsRoutes);

// V2 routes with v2 prefix (for explicit v2 access)
router.use("/v2", userAvatarVideosRoutes);
router.use("/v2", videoAvatarRoutes);
router.use("/v2", webhookV2Routes);
router.use("/v2/dynamic-posts", dynamicPostsRoutes);

export default router;
