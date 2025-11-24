import { Request, Response } from "express";
import DefaultAvatar from "../../../models/avatar";
import DefaultVoice from "../../../models/voice";
import { photoAvatarQueue } from "../../../queues/photoAvatarQueue";
import { SubscriptionService } from "../../../services/subscription.service";
import {
  validateCreatePhotoAvatar,
  CreatePhotoAvatarValidationResult,
  CreatePhotoAvatarData,
} from "../../../validations/video.validations";
import { getCurrentUser, getErrorStatus } from "../../../utils/videoHelpers";
import multer from "multer";
import { TEMP_DIR } from "../../../constants/video.constants";

const upload = multer({ dest: TEMP_DIR });

/**
 * Multer middleware for photo avatar upload
 */
export const createPhotoAvatarUpload = upload.single("image");

/**
 * Get user's avatars (custom and default)
 * GET /api/video/avatars
 */
export async function getAvatars(req: Request, res: Response) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired access token" });
    }
    const userObjectId = user._id;
    // Fetch custom avatars for user
    const customAvatars = await DefaultAvatar.find({ userId: userObjectId });
    // Fetch default avatars (no userId)
    const defaultAvatars = await DefaultAvatar.find({
      userId: { $exists: false },
      default: true,
    });
    return res.json({
      success: true,
      custom: customAvatars,
      default: defaultAvatars,
    });
  } catch (e: any) {
    const status = getErrorStatus(e);
    return res
      .status(status)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

/**
 * Get user's voices (custom and default)
 * GET /api/video/voices
 */
export async function getVoices(req: Request, res: Response) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired access token" });
    }
    const userObjectId = user._id;
    // Fetch custom voices for user
    const customVoices = await DefaultVoice.find({ userId: userObjectId });
    // Fetch default voices (no userId)
    const defaultVoices = await DefaultVoice.find({
      userId: { $exists: false },
      default: true,
    });
    return res.json({
      success: true,
      custom: customVoices,
      default: defaultVoices,
    });
  } catch (e: any) {
    const status = getErrorStatus(e);
    return res
      .status(status)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

/**
 * Create photo avatar
 * POST /api/video/photo-avatar
 */
export async function createPhotoAvatar(
  req: Request & { file?: Express.Multer.File },
  res: Response
) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Image file is required" });
    }

    const validationResult: CreatePhotoAvatarValidationResult =
      validateCreatePhotoAvatar(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
      });
    }

    const {
      age_group,
      name,
      gender,
      userId,
      ethnicity,
    }: CreatePhotoAvatarData = validationResult.data!;

    // Check for active subscription
    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getActiveSubscription(
      userId
    );
    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required to create photo avatars",
      });
    }

    // Use uploaded file path
    const tempImagePath = req.file.path;
    // Add job to BullMQ queue
    await photoAvatarQueue.add("create-photo-avatar", {
      imagePath: tempImagePath,
      age_group,
      name,
      gender,
      userId,
      ethnicity,
      mimeType: req.file.mimetype, // Pass the correct MIME type
    });
    return res.json({
      success: true,
      message:
        "Photo avatar creation started. You will be notified when ready.",
    });
  } catch (e: any) {
    const status = getErrorStatus(e);
    return res
      .status(status)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}
