import VideoSchedule, { IVideoSchedule } from "../../models/VideoSchedule";
import ScheduleEmailService from "./scheduleEmail.service";
import {
  VideoGeneratedEmailData,
  VideoProcessingEmailData,
  UserContext,
  VideoCreationData,
  VideoGenerationData,
} from "../../types/videoScheduleService.types";
import { CaptionGenerationService } from "../content";
import { notificationService } from "../notification.service";
import { generateSpeech } from "../elevenLabs";
import { VideoScheduleAPICalls } from "./api-calls.service";
import { SubscriptionService } from "../payment";
import { EmailService } from "../email.service";
import {
  generateVideoLimitReachedEmail,
  generateSubscriptionExpiredEmail,
} from "./videoScheduleFailureEmails";
import {
  PROCESSING_BUFFER_MS,
  STATUS_PENDING,
  STATUS_PROCESSING,
  STATUS_COMPLETED,
  STATUS_FAILED,
  ERROR_MESSAGES,
  EMAIL_SUBJECTS,
  FRONTEND_URL,
  DEFAULT_ZIP_CODE,
  DEFAULT_ZIP_KEYPOINTS,
  DEFAULT_OUTPUT_FORMAT,
  API_CALL_DELAY_MS,
} from "../../constants/videoScheduleService.constants";
import {
  extractAvatarId,
  extractAvatarType,
  getVoiceIdFromAvatarGender,
  getVoiceSettingsForClonedVoice,
  getMusicUrlFromTrackId,
  mapLanguageToCode,
  convertVideoCaptionToBoolean,
  generateScheduledVideoRequestId,
} from "../../utils/videoScheduleServiceHelpers";

export class VideoScheduleProcessing {
  private emailService = new ScheduleEmailService();

  /**
   * Get pending videos for processing (30 minutes early)
   */
  async getPendingVideos(): Promise<IVideoSchedule[]> {
    const now = new Date();
    const processingTime = new Date(now.getTime() + PROCESSING_BUFFER_MS);

    return await VideoSchedule.find({
      isActive: true,
      "generatedTrends.scheduledFor": {
        $gte: now,
        $lte: processingTime,
      },
      "generatedTrends.status": STATUS_PENDING,
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
    if (!schedule) throw new Error(ERROR_MESSAGES.SCHEDULE_NOT_FOUND);

    const trend = schedule.generatedTrends[trendIndex];
    if (!trend) throw new Error(ERROR_MESSAGES.TREND_NOT_FOUND);

    // ⚠️ CRITICAL: Check if video is already processing or completed to prevent duplicate processing
    if (trend.status === STATUS_PROCESSING) {
      throw new Error(ERROR_MESSAGES.VIDEO_ALREADY_PROCESSING);
    }

    if (trend.status === STATUS_COMPLETED) {
      throw new Error(ERROR_MESSAGES.VIDEO_ALREADY_COMPLETED);
    }

    // Only process if status is "pending"
    if (trend.status !== STATUS_PENDING) {
      throw new Error(`${ERROR_MESSAGES.CANNOT_PROCESS_STATUS}: ${trend.status}. ${ERROR_MESSAGES.EXPECTED_PENDING}`);
    }

    // Set status to processing atomically (prevents race conditions and duplicate processing)
    schedule.generatedTrends[trendIndex].status = STATUS_PROCESSING;
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
        const errorMessage = ERROR_MESSAGES.SUBSCRIPTION_REQUIRED;
        schedule.generatedTrends[trendIndex].status = STATUS_FAILED;
        schedule.generatedTrends[trendIndex].error = errorMessage;
        await schedule.save();

        // Send email notification to user about subscription expired
        try {
          const emailService = new EmailService();
          const emailContent = generateSubscriptionExpiredEmail({
            videoTitle: trend.description,
            frontendUrl: FRONTEND_URL,
          });
          await emailService.send(
            schedule.email,
            EMAIL_SUBJECTS.SUBSCRIPTION_EXPIRED,
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
        const errorMessage = `${ERROR_MESSAGES.VIDEO_LIMIT_REACHED}. You have used ${
          videoLimit.limit - videoLimit.remaining
        } out of ${
          videoLimit.limit
        } videos this month. Your subscription will renew monthly.`;
        schedule.generatedTrends[trendIndex].status = STATUS_FAILED;
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
            frontendUrl: FRONTEND_URL,
          });
          await emailService.send(
            schedule.email,
            EMAIL_SUBJECTS.VIDEO_LIMIT_REACHED,
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
      const userContext: UserContext = {
        name: userSettings.name,
        position: userSettings.position,
        companyName: userSettings.companyName,
        city: userSettings.city,
        socialHandles: userSettings.socialHandles,
      };

      const captions =
        await CaptionGenerationService.generateScheduledVideoCaptions(
          trend.description,
          trend.keypoints,
          userContext,
          userSettings.language
        );

      // Normalize avatar fields
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

      // Lookup avatar in DB with clean string ID
      const DefaultAvatar = require("../../models/avatar").default;
      const avatarDoc = await DefaultAvatar.findOne({
        avatar_id: titleAvatarId,
      });

      // Get voice ID from avatar gender
      const voice_id = await getVoiceIdFromAvatarGender(titleAvatarId);

      // ==================== STEP 1: CREATE VIDEO (Prompt Generation) ====================
      const videoCreationData: VideoCreationData = {
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
        language: userSettings.language,
        zipCode: DEFAULT_ZIP_CODE,
        zipKeyPoints: DEFAULT_ZIP_KEYPOINTS,
        callToAction: userSettings.callToAction,
        email: userSettings.email,
        timestamp: new Date().toISOString(),
        requestId: generateScheduledVideoRequestId(),
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
        throw new Error(`${ERROR_MESSAGES.CREATE_VIDEO_API_FAILED}: ${err.message}`);
      }

      await new Promise((r) => setTimeout(r, API_CALL_DELAY_MS));

      // ==================== STEP 1.5: CALL ELEVENLABS TTS ====================
      let ttsResult: any = null;
      let musicUrl: string | undefined = undefined;
      try {
        // Get voice_id from user settings
        const selectedVoiceId = userSettings.selectedVoiceId;
        if (selectedVoiceId) {
          // Check if voice category is "cloned" and get preset from userSettings
          const voice_settings = await getVoiceSettingsForClonedVoice(
            selectedVoiceId,
            userSettings.preset
          );

          // Call ElevenLabs TTS API
          ttsResult = await generateSpeech({
            voice_id: selectedVoiceId,
            hook: enhancedContent.hook,
            body: enhancedContent.body,
            conclusion: enhancedContent.conclusion,
            output_format: DEFAULT_OUTPUT_FORMAT,
            voice_settings: voice_settings || undefined,
          });

          // Get music URL from selectedMusicTrackId
          if (userSettings.selectedMusicTrackId) {
            musicUrl = await getMusicUrlFromTrackId(
              userSettings.selectedMusicTrackId
            );
          }
        }
      } catch (ttsError: any) {
        // Don't fail the entire process, just log the error
      }

      // Map language from userSettings to language code
      const languageCode = mapLanguageToCode(userSettings?.language);

      // Generate Video API accepts flat format and converts internally
      // Use TTS audio URLs if available, otherwise fall back to text
      const videoGenerationData: VideoGenerationData = {
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
        ...(languageCode ? { language: languageCode } : {}),
        videoCaption: convertVideoCaptionToBoolean(userSettings?.videoCaption),
        ...(musicUrl ? { music: musicUrl } : {}),
      };

      try {
        await VideoScheduleAPICalls.callGenerateVideoAPI(videoGenerationData);
      } catch (err: any) {
        throw new Error(`${ERROR_MESSAGES.GENERATE_VIDEO_API_FAILED}: ${err.message}`);
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
      schedule.generatedTrends[trendIndex].status = STATUS_FAILED;
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
      schedule.generatedTrends[trendIndex].status = status as typeof STATUS_COMPLETED | typeof STATUS_FAILED;
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
