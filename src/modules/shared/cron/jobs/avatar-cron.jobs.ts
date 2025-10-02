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

      // Check database connection and collection info
      const db = DefaultAvatar.db;
      const collectionName = DefaultAvatar.collection.name;
      console.log(`🔍 Database: ${db.name}, Collection: ${collectionName}`);

      // Get total count without loading all documents
      const totalCount = await DefaultAvatar.countDocuments({});
      console.log(`🔍 Total avatars in database: ${totalCount}`);

      // Check if there are multiple collections with similar names
      const collections = await db.listCollections();
      const avatarCollections = collections.filter((c: any) =>
        c.name.toLowerCase().includes("avatar")
      );
      console.log(
        `🔍 Avatar-related collections:`,
        avatarCollections.map((c: any) => c.name)
      );

      // Get a sample of avatars to see their statuses (limit to 20 for debugging)
      const sampleAvatars = await DefaultAvatar.find({}).limit(20);
      console.log(
        `🔍 Sample avatar statuses (first 20):`,
        sampleAvatars.map((a) => ({
          avatar_id: a.avatar_id,
          status: a.status,
          statusType: typeof a.status,
          statusValue: JSON.stringify(a.status),
          default: a.default,
        }))
      );

      // Let's also check what the exact query is looking for
      console.log(
        `🔍 Looking for avatars with status: "${"pending"}" (type: ${typeof "pending"})`
      );

      // Try different variations of the query
      const exactMatch = await DefaultAvatar.find({ status: "pending" });
      const stringMatch = await DefaultAvatar.find({
        status: { $eq: "pending" },
      });
      const regexMatch = await DefaultAvatar.find({ status: /^pending$/i });

      console.log(`🔍 Exact match query: Found ${exactMatch.length} avatars`);
      console.log(`🔍 String match query: Found ${stringMatch.length} avatars`);
      console.log(`🔍 Regex match query: Found ${regexMatch.length} avatars`);

      // Try direct MongoDB query to bypass Mongoose
      const directQuery = await DefaultAvatar.collection
        .find({ status: "pending" })
        .toArray();
      console.log(
        `🔍 Direct MongoDB query: Found ${directQuery.length} avatars`
      );

      // Check if there's a schema issue by looking at the actual documents
      if (directQuery.length > 0) {
        console.log(`🔍 First direct query result:`, {
          _id: directQuery[0]._id,
          status: directQuery[0].status,
          statusType: typeof directQuery[0].status,
          allFields: Object.keys(directQuery[0]),
        });
      }

      // Now query for pending avatars (this should work correctly)
      const pendingAvatars = await DefaultAvatar.find({ status: "pending" });
      const pendingDefaultAvatars = await DefaultAvatar.find({
        status: "pending",
        default: true,
      });
      const allPendingAvatars = await DefaultAvatar.find({
        status: { $exists: true },
      });

      console.log(
        `🔍 Avatar status check: Found ${pendingAvatars.length} pending avatars`
      );
      console.log(
        `🔍 Pending default avatars: Found ${pendingDefaultAvatars.length} pending default avatars`
      );
      console.log(
        `🔍 All avatars with status field: Found ${allPendingAvatars.length} avatars`
      );

      if (pendingAvatars.length > 0) {
        console.log(
          `🔍 Pending avatars:`,
          pendingAvatars.map((a) => ({
            avatar_id: a.avatar_id,
            avatar_name: a.avatar_name,
            status: a.status,
          }))
        );
      }

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
          console.log(`🔍 HeyGen API response for ${avatarId}:`, {
            currentStatus: avatar.status,
            apiStatus: statusData?.status,
            fullResponse: response.data,
          });

          if (statusData && statusData.status !== avatar.status) {
            console.log(
              `✅ Updating avatar ${avatarId} status from ${avatar.status} to ${statusData.status}`
            );
            avatar.status = statusData.status;
            await avatar.save();
            updatedCount++;

            // Notify users if avatar is ready
            if (statusData.status === "ready") {
              // You can add user notification logic here
              console.log(`🎉 Avatar ${avatarId} is now ready`);
            }
          } else {
            console.log(
              `ℹ️ Avatar ${avatarId} status unchanged: ${avatar.status}`
            );
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
