import axios from "axios";
import DefaultAvatar from "../../../models/avatar";
import DefaultVoice from "../../../models/voice";
import { connectMongo } from "../../../config/mongoose";
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

      const pendingAvatars = await DefaultAvatar.find({ status: "pending" });
      let updatedCount = 0;
      let errorCount = 0;

      for (const avatar of pendingAvatars) {
        try {
          const avatarId = avatar.avatar_id;
          const response = await axios.get(`${STATUS_URL}/${avatarId}`, {
            headers: {
              accept: "application/json",
              "x-api-key": API_KEY,
            },
          });

          const statusData = response.data.data;
          if (statusData && statusData.status !== avatar.status) {
            avatar.status = statusData.status;
            await avatar.save();
            updatedCount++;

            // Notify users if avatar is ready
            if (statusData.status === "ready") {
              // You can add user notification logic here
              console.log(`Avatar ${avatarId} is now ready`);
            }
          }
        } catch (error: any) {
          console.error(
            `Failed to check status for avatar ${avatar.avatar_id}:`,
            error.message
          );
          errorCount++;
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        startTime,
        endTime,
        duration,
        data: {
          checkedAvatars: pendingAvatars.length,
          updatedAvatars: updatedCount,
          errors: errorCount,
        },
      };
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: false,
        startTime,
        endTime,
        duration,
        error: error.message,
      };
    }
  };

  return {
    config,
    execute,
    onSuccess: (result) => {
      console.log(`Avatar status check completed successfully:`, result.data);
    },
    onError: (error, result) => {
      console.error(`Avatar status check failed:`, error.message);
    },
  };
};

// ==================== FETCH DEFAULT AVATARS JOB ====================

export const createFetchDefaultAvatarsJob = (): CronJob => {
  const config: CronJobConfig = {
    name: "fetch-default-avatars",
    schedule: "55 14 * * 2", // Every Tuesday at 2:55 PM
    enabled: true,
    description: "Fetch and store default avatars from HeyGen API",
    timeout: 600000, // 10 minutes
    retries: 3,
    retryDelay: 300000, // 5 minutes
  };

  const execute = async (): Promise<CronJobResult> => {
    const startTime = new Date();

    try {
      await connectMongo();

      const API_URL = `${process.env.HEYGEN_BASE_URL}/avatars`;
      const API_KEY = process.env.HEYGEN_API_KEY;

      if (!API_KEY) {
        throw new Error("HEYGEN_API_KEY environment variable is required");
      }

      const response = await axios.get(API_URL, {
        headers: {
          accept: "application/json",
          "x-api-key": API_KEY,
        },
      });

      const avatars = response.data.data?.avatars || [];
      let createdCount = 0;
      let updatedCount = 0;

      for (const avatarData of avatars) {
        try {
          const existingAvatar = await DefaultAvatar.findOne({
            avatar_id: avatarData.avatar_id,
          });

          if (existingAvatar) {
            // Update existing avatar
            existingAvatar.avatar_name =
              avatarData.name || avatarData.avatar_name;
            existingAvatar.preview_image_url =
              avatarData.avatar_url || avatarData.preview_image_url;
            existingAvatar.preview_video_url =
              avatarData.thumbnail_url || avatarData.preview_video_url;
            existingAvatar.gender = avatarData.gender;
            existingAvatar.status = avatarData.status || "ready";
            await existingAvatar.save();
            updatedCount++;
          } else {
            // Create new avatar
            await DefaultAvatar.create({
              avatar_id: avatarData.avatar_id,
              avatar_name: avatarData.name || avatarData.avatar_name,
              preview_image_url:
                avatarData.avatar_url || avatarData.preview_image_url,
              preview_video_url:
                avatarData.thumbnail_url || avatarData.preview_video_url,
              gender: avatarData.gender,
              status: avatarData.status || "ready",
            });
            createdCount++;
          }
        } catch (error: any) {
          console.error(
            `Failed to process avatar ${avatarData.avatar_id}:`,
            error.message
          );
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        startTime,
        endTime,
        duration,
        data: {
          totalAvatars: avatars.length,
          createdAvatars: createdCount,
          updatedAvatars: updatedCount,
        },
      };
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: false,
        startTime,
        endTime,
        duration,
        error: error.message,
      };
    }
  };

  return {
    config,
    execute,
    onSuccess: (result) => {
      console.log(`Default avatars fetch completed successfully:`, result.data);
    },
    onError: (error, result) => {
      console.error(`Default avatars fetch failed:`, error.message);
    },
  };
};

// ==================== FETCH DEFAULT VOICES JOB ====================

export const createFetchDefaultVoicesJob = (): CronJob => {
  const config: CronJobConfig = {
    name: "fetch-default-voices",
    schedule: "57 14 * * 2", // Every Tuesday at 2:57 PM (2 minutes after avatars)
    enabled: true,
    description: "Fetch and store default voices from HeyGen API",
    timeout: 600000, // 10 minutes
    retries: 3,
    retryDelay: 300000, // 5 minutes
  };

  const execute = async (): Promise<CronJobResult> => {
    const startTime = new Date();

    try {
      await connectMongo();

      const API_URL = `${process.env.HEYGEN_BASE_URL}/voices`;
      const API_KEY = process.env.HEYGEN_API_KEY;

      if (!API_KEY) {
        throw new Error("HEYGEN_API_KEY environment variable is required");
      }

      const response = await axios.get(API_URL, {
        headers: {
          accept: "application/json",
          "x-api-key": API_KEY,
        },
      });

      const voices = response.data.data?.voices || [];
      let createdCount = 0;
      let updatedCount = 0;

      for (const voiceData of voices) {
        try {
          const existingVoice = await DefaultVoice.findOne({
            voice_id: voiceData.voice_id,
          });

          if (existingVoice) {
            // Update existing voice
            existingVoice.name = voiceData.name;
            existingVoice.gender = voiceData.gender;
            existingVoice.language = voiceData.language;
            existingVoice.preview_audio =
              voiceData.sample_url || voiceData.preview_audio;
            await existingVoice.save();
            updatedCount++;
          } else {
            // Create new voice
            await DefaultVoice.create({
              voice_id: voiceData.voice_id,
              name: voiceData.name,
              gender: voiceData.gender,
              language: voiceData.language,
              preview_audio: voiceData.sample_url || voiceData.preview_audio,
            });
            createdCount++;
          }
        } catch (error: any) {
          console.error(
            `Failed to process voice ${voiceData.voice_id}:`,
            error.message
          );
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        startTime,
        endTime,
        duration,
        data: {
          totalVoices: voices.length,
          createdVoices: createdCount,
          updatedVoices: updatedCount,
        },
      };
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: false,
        startTime,
        endTime,
        duration,
        error: error.message,
      };
    }
  };

  return {
    config,
    execute,
    onSuccess: (result) => {
      console.log(`Default voices fetch completed successfully:`, result.data);
    },
    onError: (error, result) => {
      console.error(`Default voices fetch failed:`, error.message);
    },
  };
};
