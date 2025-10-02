import axios from "axios";
import DefaultAvatar from "../../../models/avatar";
import { connectMongo } from "../../../config/mongoose";
import { notificationService } from "../../../services/notification.service";
import { logger } from "../../../core/utils/logger";
import { JobResult } from "../types/job.types";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_BASE_URL = process.env.HEYGEN_BASE_URL;
const STATUS_URL = `${HEYGEN_BASE_URL}/photo_avatar/train/status`;

/**
 * Check pending avatars and update their status
 */
export async function checkAvatarStatus(): Promise<JobResult> {
  const startTime = Date.now();

  try {
    await connectMongo();

    const pendingAvatars = await DefaultAvatar.find({ status: "pending" });

    if (pendingAvatars.length === 0) {
      return {
        success: true,
        message: "No pending avatars to check",
        data: { checked: 0, updated: 0 },
        duration: Date.now() - startTime,
      };
    }

    let updated = 0;
    let checked = 0;

    for (const avatar of pendingAvatars) {
      checked++;
      const avatarId = avatar.avatar_id;

      try {
        const response = await axios.get(`${STATUS_URL}/${avatarId}`, {
          headers: {
            accept: "application/json",
            "X-Api-Key": HEYGEN_API_KEY,
          },
        });

        const status = response.data?.data?.status;

        if (status === "ready") {
          avatar.status = "ready";
          await avatar.save();
          updated++;

          logger.info(`Avatar ${avatarId} is now ready`);

          // Send notification to user that avatar is ready
          if (avatar.userId) {
            notificationService.notifyPhotoAvatarProgress(
              avatar.userId.toString(),
              "ready",
              "success",
              {
                message: "Your avatar training is complete and ready to use!",
                avatarId: avatar.avatar_id,
                previewImageUrl: avatar.preview_image_url,
              }
            );
          }
        }
      } catch (error) {
        logger.error(`Error checking avatar ${avatarId} status`, error);
        // Continue checking other avatars even if one fails
      }
    }

    const duration = Date.now() - startTime;

    logger.info("Avatar status check completed", {
      checked,
      updated,
      duration,
    });

    return {
      success: true,
      message: `Avatar status check completed: ${updated}/${checked} avatars updated`,
      data: { checked, updated },
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Avatar status check failed", error);

    return {
      success: false,
      message: "Avatar status check failed",
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    };
  }
}
