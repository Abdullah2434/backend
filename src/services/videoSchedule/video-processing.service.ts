import VideoSchedule, { IVideoSchedule } from "../../models/VideoSchedule";
import ScheduleEmailService, {
  VideoGeneratedEmailData,
  VideoProcessingEmailData,
} from "../scheduleEmail.service";
import CaptionGenerationService from "../captionGeneration.service";
import { notificationService } from "../notification.service";
import { generateSpeech } from "../elevenLabsTTS.service";
import MusicTrack from "../../models/MusicTrack";
import { S3Service } from "../s3";
import { VideoScheduleAPICalls } from "./api-calls.service";
import { text } from "stream/consumers";
import { SubscriptionService } from "../subscription.service";
import ElevenLabsVoice from "../../models/elevenLabsVoice";
import { EmailService } from "../email";
import {
  generateVideoLimitReachedEmail,
  generateSubscriptionExpiredEmail,
} from "../videoScheduleFailureEmails";

/**
 * Get voice settings based on preset (case insensitive)
 */
function getVoiceSettingsByPreset(preset: string): {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
} | null {
  const presetLower = preset?.toLowerCase().trim();

  if (presetLower === "low") {
    return {
      stability: 0.75, // Lower for more natural variation
      similarity_boost: 0.8, // Higher for better voice match
      style: 0.0, // Lower for more natural delivery
      use_speaker_boost: true,
      speed: 0.85, // Slightly faster but still natural
    };
  } else if (presetLower === "medium" || presetLower === "mid") {
    return {
      stability: 0.5, // Balanced for natural speech
      similarity_boost: 0.75, // Higher for better voice match
      style: 0.2, // Lower for natural delivery
      use_speaker_boost: true,
      speed: 1.0, // Natural pace
    };
  } else if (presetLower === "high") {
    return {
      stability: 0.25, // Slightly higher but still allows variation
      similarity_boost: 0.7, // Higher for better voice match
      style: 0.5, // Very low for most natural delivery
      use_speaker_boost: true,
      speed: 1.15, // Slightly slower for emphasis
    };
  }

  return null;
}

export class VideoScheduleProcessing {
  private emailService = new ScheduleEmailService();

  /**
   * Get pending videos for processing (30 minutes early)
   */
  async getPendingVideos(): Promise<IVideoSchedule[]> {
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    return await VideoSchedule.find({
      isActive: true,
      "generatedTrends.scheduledFor": {
        $gte: now,
        $lte: thirtyMinutesFromNow,
      },
      "generatedTrends.status": "pending",
    });
  }

  /**
   * Process scheduled video
   */
  async processScheduledVideo(
    scheduleId: string,
    trendIndex: number,
    userSettings: any
  ): Promise<void> {
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const trend = schedule.generatedTrends[trendIndex];
    if (!trend) throw new Error("Trend not found");

    // ⚠️ CRITICAL: Check if video is already processing or completed to prevent duplicate processing
    if (trend.status === "processing") {
      throw new Error(`Video is already being processed for trend ${trendIndex}`);
    }

    if (trend.status === "completed") {
      throw new Error(`Video is already completed for trend ${trendIndex}`);
    }

    // Only process if status is "pending"
    if (trend.status !== "pending") {
      throw new Error(`Cannot process video with status: ${trend.status}. Expected: pending`);
    }

    // Set status to processing atomically (prevents race conditions and duplicate processing)
    schedule.generatedTrends[trendIndex].status = "processing";
    await schedule.save();

    // Check subscription status and limit before processing
    try {
      const subscriptionService = new SubscriptionService();

      // First check if user has active subscription
      const subscription = await subscriptionService.getActiveSubscription(
        schedule.userId.toString()
      );

      if (!subscription) {
        // Update trend status to failed
        const errorMessage =
          "Active subscription required. Your subscription has expired or is not active.";
        schedule.generatedTrends[trendIndex].status = "failed";
        schedule.generatedTrends[trendIndex].error = errorMessage;
        await schedule.save();

        // Send email notification to user about subscription expired
        try {
          const emailService = new EmailService();
          const emailContent = generateSubscriptionExpiredEmail({
            videoTitle: trend.description,
            frontendUrl:
              process.env.FRONTEND_URL || "https://www.edgeairealty.com",
          });
          await emailService.send(
            schedule.email,
            "⚠️ Scheduled Video Failed: Subscription Required",
            emailContent
          );
        } catch (emailErr) {
          // Log email error but don't fail the process
          console.error("Failed to send subscription expired email:", emailErr);
        }

        throw new Error(errorMessage);
      }

      // Then check video limit
      const videoLimit = await subscriptionService.canCreateVideo(
        schedule.userId.toString()
      );
      if (!videoLimit.canCreate) {
        // Update trend status to failed with detailed error message
        const errorMessage = `Video limit reached. You have used ${
          videoLimit.limit - videoLimit.remaining
        } out of ${
          videoLimit.limit
        } videos this month. Your subscription will renew monthly.`;
        schedule.generatedTrends[trendIndex].status = "failed";
        schedule.generatedTrends[trendIndex].error = errorMessage;
        await schedule.save();

        // Send email notification to user about video limit reached
        try {
          const emailService = new EmailService();
          const emailContent = generateVideoLimitReachedEmail({
            videoTitle: trend.description,
            limit: videoLimit.limit,
            remaining: videoLimit.remaining,
            used: videoLimit.limit - videoLimit.remaining,
            frontendUrl:
              process.env.FRONTEND_URL || "https://www.edgeairealty.com",
          });
          await emailService.send(
            schedule.email,
            "⚠️ Scheduled Video Failed: Video Limit Reached",
            emailContent
          );
        } catch (emailErr) {
          // Log email error but don't fail the process
          console.error("Failed to send video limit email:", emailErr);
        }

        throw new Error(errorMessage);
      }
    } catch (subErr: any) {
      // If it's a subscription error, rethrow it (don't call APIs)
      if (
        subErr.message.includes("subscription") ||
        subErr.message.includes("Video limit reached")
      ) {
        throw subErr;
      }
    }

    // Send processing email (only sent once since we prevent duplicate processing above)
    try {
      const processingEmailData: VideoProcessingEmailData = {
        userEmail: schedule.email,
        scheduleId: schedule._id.toString(),
        videoTitle: trend.description,
        videoDescription: trend.description,
        videoKeypoints: trend.keypoints,
        startedAt: new Date(),
        timezone: schedule.timezone,
      };
      await this.emailService.sendVideoProcessingEmail(processingEmailData);
    } catch (emailError) {
      // Email sending failed, but don't fail the process
    }

    notificationService.notifyScheduledVideoProgress(
      schedule.userId.toString(),
      "video-creation",
      "progress",
      {
        message: `Scheduled video "${trend.description}" is being created`,
        scheduleId: scheduleId,
        trendIndex: trendIndex,
        videoTitle: trend.description,
      }
    );

    try {
      const captions =
        await CaptionGenerationService.generateScheduledVideoCaptions(
          trend.description,
          trend.keypoints,
          {
            name: userSettings.name,
            position: userSettings.position,
            companyName: userSettings.companyName,
            city: userSettings.city,
            socialHandles: userSettings.socialHandles,
          }
        );

      // ✅ Helper functions to extract clean IDs and types
      const extractAvatarId = (avatarValue: any): string => {
        if (!avatarValue) return "";
        if (typeof avatarValue === "string") return avatarValue.trim();
        if (typeof avatarValue === "object" && avatarValue.avatar_id)
          return String(avatarValue.avatar_id).trim();
        return "";
      };

      const extractAvatarType = (avatarValue: any): string => {
        if (typeof avatarValue === "object" && avatarValue.avatarType)
          return String(avatarValue.avatarType).trim();
        return "video_avatar";
      };

      // ✅ Normalize avatar fields
      const titleAvatarId = extractAvatarId(userSettings.titleAvatar);
      const bodyAvatarId = extractAvatarId(
        userSettings.bodyAvatar || userSettings.avatar?.[0]
      );
      const conclusionAvatarId = extractAvatarId(userSettings.conclusionAvatar);

      const titleAvatarType = extractAvatarType(userSettings.titleAvatar);
      const bodyAvatarType = extractAvatarType(
        userSettings.bodyAvatar || userSettings.avatar?.[0]
      );
      const conclusionAvatarType = extractAvatarType(
        userSettings.conclusionAvatar
      );

      // ✅ Lookup avatar in DB with clean string ID
      const DefaultAvatar = require("../../models/avatar").default;
      const avatarDoc = await DefaultAvatar.findOne({
        avatar_id: titleAvatarId,
      });

      const gender = avatarDoc ? avatarDoc.gender : undefined;
      let voice_id: string | undefined = undefined;
      if (gender) {
        const DefaultVoice = require("../../models/voice").default;
        const voiceDoc = await DefaultVoice.findOne({ gender });
        voice_id = voiceDoc ? voiceDoc.voice_id : undefined;
      }

      // ==================== STEP 1: CREATE VIDEO (Prompt Generation) ====================
      const videoCreationData = {
        prompt: userSettings.prompt,
        avatar: titleAvatarId,
        name: userSettings.name,
        position: userSettings.position,
        companyName: userSettings.companyName,
        license: userSettings.license,
        tailoredFit: userSettings.tailoredFit,
        socialHandles: userSettings.socialHandles,
        videoTopic: trend.description,
        topicKeyPoints: trend.keypoints,
        city: userSettings.city,
        preferredTone: userSettings.preferredTone,
        zipCode: 90014,
        zipKeyPoints: "new bars and restaurants",
        callToAction: userSettings.callToAction,
        email: userSettings.email,
        timestamp: new Date().toISOString(),
        requestId: `scheduled_video_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        isScheduled: true,
        scheduleId: scheduleId,
        trendIndex: trendIndex,
      };

      let enhancedContent: any;
      try {
        enhancedContent = await VideoScheduleAPICalls.callCreateVideoAPI(
          videoCreationData
        );
      } catch (err: any) {
        throw new Error(`Create Video API failed: ${err.message}`);
      }

      await new Promise((r) => setTimeout(r, 2000));

      // ==================== STEP 1.5: CALL ELEVENLABS TTS ====================
      let ttsResult: any = null;
      let musicUrl: string | undefined = undefined;
      try {
        // Get voice_id from user settings
        const selectedVoiceId = userSettings.selectedVoiceId;
        if (!selectedVoiceId) {
        } else {
          // Check if voice category is "cloned" and get preset from userSettings
          let voice_settings = null;
          try {
            const voice = await ElevenLabsVoice.findOne({
              voice_id: selectedVoiceId,
            });
            if (voice) {
              const voiceCategory = voice.category?.toLowerCase().trim();

              if (voiceCategory === "cloned") {
                // Get preset directly from userSettings (already know which user)
                const preset = userSettings.preset;

                if (preset) {
                  voice_settings = getVoiceSettingsByPreset(preset);
                } else {
                  console.log(
                    `⚠️ No preset found in user settings for auto posting`
                  );
                }
              }
            }
          } catch (voiceError: any) {
            // Continue without voice_settings if there's an error
          }

          // Call ElevenLabs TTS API
          ttsResult = await generateSpeech({
            voice_id: selectedVoiceId,
            hook: enhancedContent.hook,
            body: enhancedContent.body,
            conclusion: enhancedContent.conclusion,
            output_format: "mp3_44100_128",
            voice_settings: voice_settings || undefined, // Pass voice_settings if available
          });

          // Get music URL from selectedMusicTrackId
          // Auto: Find track by ID → Extract S3 key from s3FullTrackUrl → Convert to clean MP3 URL

          if (userSettings.selectedMusicTrackId) {
            try {
              // Step 1: Find music track by ID from userSettings
              const musicTrack = await MusicTrack.findById(
                userSettings.selectedMusicTrackId
              );

              if (!musicTrack) {
                console.warn(
                  `⚠️ Music track not found with ID: ${userSettings.selectedMusicTrackId}`
                );
              } else if (!musicTrack.s3FullTrackUrl) {
                console.warn(
                  `⚠️ Music track has no s3FullTrackUrl: ${musicTrack._id}`
                );
              } else {
                // Step 2: Extract S3 key from s3FullTrackUrl (stored in DB)
                const extractS3KeyFromUrl = (url: string): string | null => {
                  try {
                    // If it's already a key (no http/https), return as is
                    if (
                      !url.startsWith("http://") &&
                      !url.startsWith("https://")
                    ) {
                      return url;
                    }

                    // If it's a URL, extract the path
                    const urlObj = new URL(url);
                    let s3Key = urlObj.pathname;

                    // Remove leading slash
                    if (s3Key.startsWith("/")) {
                      s3Key = s3Key.substring(1);
                    }

                    // Remove bucket name if present in path
                    const bucketEnv = process.env.AWS_S3_BUCKET || "";
                    const bucketName = bucketEnv.split("/")[0];
                    if (bucketName && s3Key.startsWith(bucketName + "/")) {
                      s3Key = s3Key.substring(bucketName.length + 1);
                    }

                    return s3Key;
                  } catch (error: any) {
                    return null;
                  }
                };

                const s3Key = extractS3KeyFromUrl(musicTrack.s3FullTrackUrl);

                if (!s3Key) {
                } else {
                  // Step 3: Ensure key ends with .mp3
                  const finalS3Key = s3Key.endsWith(".mp3")
                    ? s3Key
                    : s3Key + ".mp3";

                  // Step 4: Convert S3 key to clean MP3 URL (without query parameters)
                  const s3Service = new S3Service({
                    region: process.env.AWS_REGION || "us-east-1",
                    bucketName: process.env.AWS_S3_BUCKET || "",
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
                  });

                  // Generate clean MP3 URL (S3 key is already stored in DB)
                  musicUrl = await s3Service.getMusicTrackUrl(
                    finalS3Key,
                    604800
                  );

                  // Ensure URL ends with .mp3 (safety check)
                  if (!musicUrl.endsWith(".mp3")) {
                    musicUrl = musicUrl + ".mp3";
                  }
                }
              }
            } catch (musicError: any) {
              // Don't fail the entire process, just log the error
            }
          } else {
          }
        }
      } catch (ttsError: any) {
        // Don't fail the entire process, just log the error
      }

      // Generate Video API accepts flat format and converts internally
      // Use TTS audio URLs if available, otherwise fall back to text
      const videoGenerationData = {
        hook: ttsResult?.hook_url, // Audio URL from TTS or text string from API
        body: ttsResult?.body_url, // Audio URL from TTS or text string from API
        conclusion: ttsResult?.conclusion_url, // Audio URL from TTS or text string from API
        text: enhancedContent.body,
        company_name: userSettings.companyName,
        social_handles: userSettings.socialHandles,
        license: userSettings.license,
        email: userSettings.email,
        avatar_title: titleAvatarId,
        avatar_body: bodyAvatarId,
        avatar_conclusion: conclusionAvatarId,
        title: trend.description,
        voice: voice_id,
        isDefault: avatarDoc?.default,
        timestamp: new Date().toISOString(),
        isScheduled: true,
        scheduleId: scheduleId,
        trendIndex: trendIndex,
        _captions: captions,
        ...(musicUrl ? { music: musicUrl } : {}),
      };

      try {
        await VideoScheduleAPICalls.callGenerateVideoAPI(videoGenerationData);
      } catch (err: any) {
        throw new Error(`Generate Video API failed: ${err.message}`);
      }

      notificationService.notifyScheduledVideoProgress(
        schedule.userId.toString(),
        "video-creation",
        "success",
        {
          message: `Video "${trend.description}" creation initiated successfully`,
          scheduleId: scheduleId,
          trendIndex: trendIndex,
          videoTitle: trend.description,
          nextStep: "Video will be processed and auto-posted when ready",
        }
      );
    } catch (error: any) {
      schedule.generatedTrends[trendIndex].status = "failed";
      await schedule.save();

      notificationService.notifyScheduledVideoProgress(
        schedule.userId.toString(),
        "video-creation",
        "error",
        {
          message: `Failed to create video "${trend.description}": ${error.message}`,
          scheduleId,
          trendIndex,
          videoTitle: trend.description,
          error: error.message,
        }
      );
    }
  }

  /**
   * Update video status after processing
   */
  async updateVideoStatus(
    scheduleId: string,
    trendIndex: number,
    status: "completed" | "failed",
    videoId?: string
  ): Promise<void> {
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    if (schedule.generatedTrends[trendIndex]) {
      schedule.generatedTrends[trendIndex].status = status;
      if (videoId) {
        schedule.generatedTrends[trendIndex].videoId = videoId;
      }
      await schedule.save();

      const trend = schedule.generatedTrends[trendIndex];

      // Log status update (no WebSocket notification)
      const statusMessage =
        status === "completed"
          ? `✅ Scheduled video "${trend.description}" completed for user ${schedule.userId}`
          : `❌ Scheduled video "${trend.description}" failed for user ${schedule.userId}`;
    }
  }
}
