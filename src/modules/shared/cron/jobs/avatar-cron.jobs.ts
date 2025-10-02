import axios from "axios";
import DefaultAvatar from "../../../../database/models/avatar";
import DefaultVoice from "../../../../database/models/voice";
import { connectMongo } from "../../../../database/connection";
import { notificationService } from "../../notification";
import {
  CronJob,
  CronJobResult,
  CronJobConfig,
  CronJobCategory,
} from "../types/cron.types";

// ==================== AVATAR STATUS CHECK JOB ====================

export const createAvatarStatusCheckJob = (): CronJob => {
  const config: CronJobConfig = {
    name: "avatar-status-check",
    schedule: "*/2 * * * *", // Every 2 minutes
    enabled: true,
    description: "Check pending avatar training status and update database",
    timeout: 300000, // 5 minutes
    retries: 2,
    retryDelay: 60000, // 1 minute
  };

  const execute = async (): Promise<CronJobResult> => {
    const startTime = new Date();

    try {
      await connectMongo();

      const API_KEY = process.env.HEYGEN_API_KEY;
      const STATUS_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/train/status`;

      if (!API_KEY) {
        throw new Error("HEYGEN_API_KEY environment variable is required");
      }

      // Simple query for pending avatars (like original implementation)
      const pendingAvatars = await DefaultAvatar.find({ status: "pending" });

      console.log(`🔍 Found ${pendingAvatars.length} pending avatars to check`);

      let updatedCount = 0;
      let errorCount = 0;

      for (const avatar of pendingAvatars) {
        try {
          const avatarId = avatar.avatar_id;

          const response = await axios.get(`${STATUS_URL}/${avatarId}`, {
            headers: {
              accept: "application/json",
              "X-Api-Key": API_KEY,
            },
          });

          const status = response.data?.data?.status;

          // Only update to 'ready' when HeyGen returns 'ready' (like original)
          if (status === "ready") {
            avatar.status = "ready";
            await avatar.save();
            updatedCount++;

            console.log(`✅ Avatar ${avatarId} is now ready`);

            // Send notification to user that avatar is ready
            if (avatar.userId) {
              await notificationService.notifyPhotoAvatarProgress(
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
          } else {
            console.log(
              `ℹ️ Avatar ${avatarId} status: ${status} (still pending)`
            );
          }
        } catch (error: any) {
          console.error(
            `❌ Failed to check status for avatar ${avatar.avatar_id}:`,
            error.message
          );
          errorCount++;
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        data: {
          updatedCount,
          errorCount,
          totalChecked: pendingAvatars.length,
          message: `Avatar status check completed. Updated: ${updatedCount}, Errors: ${errorCount}`,
        },
        startTime,
        endTime,
        duration,
      };
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error("❌ Avatar status check job failed:", error);

      return {
        success: false,
        error: error.message,
        startTime,
        endTime,
        duration,
      };
    }
  };

  return {
    config,
    execute,
  };
};

// ==================== FETCH DEFAULT AVATARS JOB ====================

export const createFetchDefaultAvatarsJob = (): CronJob => {
  const config: CronJobConfig = {
    name: "fetch-default-avatars",
    schedule: "0 0 * * *", // Daily at midnight
    enabled: true,
    description: "Fetch default avatars from HeyGen API",
    timeout: 300000, // 5 minutes
    retries: 2,
    retryDelay: 60000, // 1 minute
  };

  const execute = async (): Promise<CronJobResult> => {
    const startTime = new Date();

    try {
      await connectMongo();

      const API_KEY = process.env.HEYGEN_API_KEY;
      const AVATARS_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/list`;

      if (!API_KEY) {
        throw new Error("HEYGEN_API_KEY environment variable is required");
      }

      const response = await axios.get(AVATARS_URL, {
        headers: {
          accept: "application/json",
          "X-Api-Key": API_KEY,
        },
      });

      const avatars = response.data?.data || [];
      let savedCount = 0;

      for (const avatarData of avatars) {
        try {
          await DefaultAvatar.findOneAndUpdate(
            { avatar_id: avatarData.avatar_id },
            {
              avatar_id: avatarData.avatar_id,
              avatar_name: avatarData.avatar_name,
              gender: avatarData.gender,
              preview_image_url: avatarData.preview_image_url,
              preview_video_url: avatarData.preview_video_url,
              default: true,
              status: "pending",
            },
            { upsert: true, new: true }
          );
          savedCount++;
        } catch (error: any) {
          console.error(
            `Failed to save avatar ${avatarData.avatar_id}:`,
            error.message
          );
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        data: {
          savedCount,
          totalAvatars: avatars.length,
          message: `Fetched and saved ${savedCount} default avatars`,
        },
        startTime,
        endTime,
        duration,
      };
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error("❌ Fetch default avatars job failed:", error);

      return {
        success: false,
        error: error.message,
        startTime,
        endTime,
        duration,
      };
    }
  };

  return {
    config,
    execute,
  };
};

// ==================== FETCH DEFAULT VOICES JOB ====================

export const createFetchDefaultVoicesJob = (): CronJob => {
  const config: CronJobConfig = {
    name: "fetch-default-voices",
    schedule: "0 1 * * *", // Daily at 1 AM
    enabled: true,
    description: "Fetch default voices from HeyGen API",
    timeout: 300000, // 5 minutes
    retries: 2,
    retryDelay: 60000, // 1 minute
  };

  const execute = async (): Promise<CronJobResult> => {
    const startTime = new Date();

    try {
      await connectMongo();

      const API_KEY = process.env.HEYGEN_API_KEY;
      const VOICES_URL = `${process.env.HEYGEN_BASE_URL}/voice/list`;

      if (!API_KEY) {
        throw new Error("HEYGEN_API_KEY environment variable is required");
      }

      const response = await axios.get(VOICES_URL, {
        headers: {
          accept: "application/json",
          "X-Api-Key": API_KEY,
        },
      });

      const voices = response.data?.data || [];
      let savedCount = 0;

      for (const voiceData of voices) {
        try {
          await DefaultVoice.findOneAndUpdate(
            { voice_id: voiceData.voice_id },
            {
              voice_id: voiceData.voice_id,
              name: voiceData.voice_name,
              gender: voiceData.gender,
              language: voiceData.language,
              preview_audio: voiceData.preview_audio,
              default: true,
            },
            { upsert: true, new: true }
          );
          savedCount++;
        } catch (error: any) {
          console.error(
            `Failed to save voice ${voiceData.voice_id}:`,
            error.message
          );
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        data: {
          savedCount,
          totalVoices: voices.length,
          message: `Fetched and saved ${savedCount} default voices`,
        },
        startTime,
        endTime,
        duration,
      };
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error("❌ Fetch default voices job failed:", error);

      return {
        success: false,
        error: error.message,
        startTime,
        endTime,
        duration,
      };
    }
  };

  return {
    config,
    execute,
  };
};
