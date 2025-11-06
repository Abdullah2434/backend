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
        schedule.generatedTrends[trendIndex].status = "failed";
        schedule.generatedTrends[trendIndex].error = 
          "Active subscription required. Your subscription has expired or is not active.";
        await schedule.save();
        
        throw new Error(
          "Active subscription required. Your subscription has expired or is not active."
        );
      }
      
      // Then check video limit
      const videoLimit = await subscriptionService.canCreateVideo(
        schedule.userId.toString()
      );
      if (!videoLimit.canCreate) {
        // Update trend status to failed
        schedule.generatedTrends[trendIndex].status = "failed";
        schedule.generatedTrends[trendIndex].error = 
          "Video limit reached. You can create up to 30 videos per month. Your subscription will renew monthly.";
        await schedule.save();
        
        throw new Error(
          "Video limit reached. You can create up to 30 videos per month. Your subscription will renew monthly."
        );
      }
    } catch (subErr: any) {
      // If it's a subscription error, rethrow it (don't call APIs)
      if (subErr.message.includes("subscription") || subErr.message.includes("Video limit reached")) {
        throw subErr;
      }
      // For other errors, log and continue (might be a temporary issue)
      console.error("Subscription check failed for scheduled video:", subErr);
    }

    // Send processing email (non-blocking)
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
      console.error("Error sending video processing email:", emailError);
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
      console.log("🎨 Generating social media captions...");
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

      console.log("✅ Captions generated successfully");

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

      console.log("🔄 Step 1: Calling Create Video API...");
      let enhancedContent: any;
      try {
        enhancedContent = await VideoScheduleAPICalls.callCreateVideoAPI(
          videoCreationData
        );
        console.log("✅ Step 1: Create Video API successful");
      } catch (err: any) {
        console.error("❌ Step 1 failed:", err);
        throw new Error(`Create Video API failed: ${err.message}`);
      }

      await new Promise((r) => setTimeout(r, 2000));

      // ==================== STEP 1.5: CALL ELEVENLABS TTS AND SECOND WEBHOOK ====================
      try {
        // Get voice_id from user settings
        const selectedVoiceId = userSettings.selectedVoiceId;
        if (!selectedVoiceId) {
          console.warn(
            "⚠️ No selectedVoiceId found in user settings, skipping ElevenLabs TTS"
          );
        } else {
          console.log(`🎤 Generating speech with voice_id: ${selectedVoiceId}`);

          // Call ElevenLabs TTS API
          const ttsResult = await generateSpeech({
            voice_id: selectedVoiceId,
            hook: enhancedContent.hook,
            body: enhancedContent.body,
            conclusion: enhancedContent.conclusion,
            output_format: "mp3_44100_128",
          });

          console.log("✅ ElevenLabs TTS completed:", {
            hook_url: ttsResult.hook_url,
            body_url: ttsResult.body_url,
            conclusion_url: ttsResult.conclusion_url,
          });

          // Get music URL for second webhook from selectedMusicTrackId
          // Auto: Find track by ID → Extract S3 key from s3FullTrackUrl → Convert to clean MP3 URL
          let musicUrl: string | undefined = undefined;

          if (userSettings.selectedMusicTrackId) {
            try {
              console.log(
                `🎵 Finding music track with ID: ${userSettings.selectedMusicTrackId}`
              );

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
                console.log(
                  `✅ Found music track: ${musicTrack.name} (${musicTrack.energyCategory})`
                );

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
                    console.error("Error extracting S3 key from URL:", error);
                    return null;
                  }
                };

                const s3Key = extractS3KeyFromUrl(musicTrack.s3FullTrackUrl);

                if (!s3Key) {
                  console.warn(
                    `⚠️ Could not extract S3 key from URL: ${musicTrack.s3FullTrackUrl}`
                  );
                } else {
                  console.log(`📦 Extracted S3 key: ${s3Key}`);

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

                  console.log(
                    `✅ Music track URL generated (clean MP3 URL): ${musicUrl}`
                  );
                }
              }
            } catch (musicError: any) {
              console.error(
                `❌ Failed to get music track URL:`,
                musicError.message
              );
              // Don't fail the entire process, just log the error
            }
          } else {
            console.log(
              "ℹ️ No selectedMusicTrackId in user settings, skipping music"
            );
          }

          // Call second webhook with structured format
          // hook/body/conclusion are objects with audio URL, avatar, and avatarType
          const secondWebhookUrl = process.env.GENERATE_VIDEO_WEBHOOK_URL;
          if (secondWebhookUrl) {
            const secondWebhookPayload = {
              // Structured format: hook/body/conclusion as objects with text URL, audio URL, avatar, avatarType
              hook: {
                audio: ttsResult.hook_url, // URL from ElevenLabs TTS
                avatar: titleAvatarId,
                avatarType: titleAvatarType,
              },
              body: {
                audio: ttsResult.body_url, // URL from ElevenLabs TTS
                avatar: bodyAvatarId,
                text: enhancedContent.body, // URL from ElevenLabs TTS
                avatarType: bodyAvatarType,
              },
              conclusion: {
                audio: ttsResult.conclusion_url, 
                avatar: conclusionAvatarId,
                avatarType: conclusionAvatarType,
              },
              company_name: userSettings.companyName,
              social_handles: userSettings.socialHandles,
              license: userSettings.license,
              email: userSettings.email,
              title: trend.description,
              voice: voice_id,
              isDefault: avatarDoc?.default,
              timestamp: new Date().toISOString(),
              isScheduled: true,
              scheduleId: scheduleId,
              trendIndex: trendIndex,
              _captions: captions,
              // Include music URL (string) if available
              ...(musicUrl ? { music: musicUrl } : {}),
            };

            await VideoScheduleAPICalls.callSecondWebhook(
              secondWebhookUrl,
              secondWebhookPayload
            );
            console.log(
              "✅ Second webhook called successfully with videoGenerationData structure"
            );
          } else {
            console.log("⚠️ Second webhook URL not configured, skipping");
          }
        }
      } catch (ttsError: any) {
        console.error("❌ ElevenLabs TTS or second webhook failed:", ttsError);
        // Don't fail the entire process, just log the error
      }

      // Generate Video API accepts flat format and converts internally
      // So we send: hook (text), body (text), conclusion (text) + separate avatar fields
  

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
      console.error("Error processing scheduled video:", error);
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

      // Send email notification for completed videos
      if (status === "completed") {
        try {
          // Check if this is the last video in the schedule
          const completedVideos = schedule.generatedTrends.filter(
            (t: any) => t.status === "completed"
          ).length;
          const totalVideos = schedule.generatedTrends.length;
          const isLastVideo = completedVideos === totalVideos;

          const emailData: VideoGeneratedEmailData = {
            userEmail: schedule.email,
            scheduleId: schedule._id.toString(),
            videoTitle: trend.description,
            videoDescription: trend.description,
            videoKeypoints: trend.keypoints,
            generatedAt: new Date(),
            videoId: videoId,
            isLastVideo: isLastVideo,
            timezone: schedule.timezone, // Add timezone for email display
          };

          await this.emailService.sendVideoGeneratedEmail(emailData);
        } catch (emailError) {
          console.error("Error sending video generated email:", emailError);
          // Don't fail the status update if email fails
        }
      }

      // Log status update (no WebSocket notification)
      const statusMessage =
        status === "completed"
          ? `✅ Scheduled video "${trend.description}" completed for user ${schedule.userId}`
          : `❌ Scheduled video "${trend.description}" failed for user ${schedule.userId}`;

      console.log(statusMessage);
    }
  }
}
