import VideoService from "./video.service";
import {
  VideoCompleteData,
  WebhookResult,
  WebhookRequest,
  WebhookResponse,
} from "../types";
import VideoScheduleService from "./videoSchedule.service";
import AutoSocialPostingService from "./autoSocialPosting.service";
import PostWebhookDynamicGenerationService from "./postWebhookDynamicGeneration.service";
import VideoWebhookStatus from "../models/VideoWebhookStatus";
import { generateFromDescription } from "./trends.service";
import {
  buildWebhookPayloadWithUser,
  buildWebhookHeaders,
  buildSuccessWebhookResponse,
  buildErrorWebhookResponse,
  buildWebhookResult,
  validateVideoId,
  verifyWebhookSignature as verifySignature,
} from "../utils/webhookHelpers";

export class WebhookService {
  private videoService: VideoService;
  private videoScheduleService: VideoScheduleService;
  private autoSocialPostingService: AutoSocialPostingService;
  private postWebhookDynamicGenerationService: PostWebhookDynamicGenerationService;

  constructor() {
    this.videoService = new VideoService();
    this.videoScheduleService = new VideoScheduleService();
    this.autoSocialPostingService = new AutoSocialPostingService();
    this.postWebhookDynamicGenerationService =
      new PostWebhookDynamicGenerationService();
  }

  /**
   * Send webhook notification with user information
   */
  async sendWebhookNotification(
    webhookUrl: string,
    payload: WebhookRequest,
    user?: any
  ): Promise<WebhookResponse> {
    try {
      const webhookPayload = buildWebhookPayloadWithUser(payload, user);
      const headers = buildWebhookHeaders(webhookPayload);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        throw new Error(
          `Webhook failed: ${response.status} ${response.statusText}`
        );
      }

      const responseData = await response.json().catch(() => ({}));
      return buildSuccessWebhookResponse(responseData);
    } catch (error: any) {
      return buildErrorWebhookResponse(error);
    }
  }

  /**
   * Verify webhook signature (delegates to helper function)
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    return verifySignature(payload, signature);
  }

  /**
   * Validate user token (placeholder implementation)
   */
  private async validateUserToken(token: string): Promise<any> {
    return {
      id: "user123",
      email: "user@example.com",
      firstName: "John",
      lastName: "Doe",
    };
  }

  /**
   * Process webhook with user authentication
   */
  async processWebhookWithAuth(
    webhookUrl: string,
    payload: WebhookRequest,
    userToken?: string
  ): Promise<WebhookResponse> {
    try {
      let user = null;

      // Validate user token if provided
      if (userToken) {
        user = await this.validateUserToken(userToken);
        payload.user_id = user.id;
      }

      // Send webhook notification
      return await this.sendWebhookNotification(webhookUrl, payload, user);
    } catch (error: any) {
      return buildErrorWebhookResponse(error);
    }
  }

  /**
   * Track webhook completion and trigger dynamic generation when both webhooks are done
   */
  async trackWebhookCompletion(
    videoId: string,
    webhookType: "video" | "caption",
    email: string,
    title: string
  ): Promise<void> {
    try {
      // Find or create webhook status record
      let webhookStatus = await VideoWebhookStatus.findOne({ videoId });

      if (!webhookStatus) {
        webhookStatus = new VideoWebhookStatus({
          videoId,
          email,
          title,
          videoWebhookCompleted: false,
          captionWebhookCompleted: false,
          allWebhooksCompleted: false,
        });
      }

      // Update the specific webhook completion status
      if (webhookType === "video") {
        webhookStatus.videoWebhookCompleted = true;
        webhookStatus.videoWebhookCompletedAt = new Date();
      } else if (webhookType === "caption") {
        webhookStatus.captionWebhookCompleted = true;
        webhookStatus.captionWebhookCompletedAt = new Date();
      }

      // Check if both webhooks are completed
      const bothCompleted =
        webhookStatus.videoWebhookCompleted &&
        webhookStatus.captionWebhookCompleted;

      if (bothCompleted && !webhookStatus.allWebhooksCompleted) {
        webhookStatus.allWebhooksCompleted = true;
        webhookStatus.allWebhooksCompletedAt = new Date();
        await this.postWebhookDynamicGenerationService.processDynamicGenerationForVideo(
          videoId,
          email,
          title
        );

        // Call trends API to generate keypoints from description (video title)
        try {
          // Get city from UserVideoSettings using email
          const UserVideoSettings =
            require("../models/UserVideoSettings").default;
          const userSettings = await UserVideoSettings.findOne({
            email: email,
          });
          const videoCity = userSettings?.city || null;

          if (videoCity) {
          } else {
          }

          // Call generateFromDescription API with video title as description
          const keypointsResult = await generateFromDescription(
            title,
            videoCity || undefined
          );

          if (keypointsResult && keypointsResult.keypoints) {
            // Update PendingCaptions with generated keypoints
            const PendingCaptions =
              require("../models/PendingCaptions").default;
            await PendingCaptions.findOneAndUpdate(
              {
                email: email,
                title: title,
              },
              {
                keypoints: keypointsResult.keypoints,
                // Keep other fields intact
              },
              { upsert: true, new: true }
            );
          }
        } catch (keypointsError: any) {
          // Don't fail the webhook if keypoints generation fails
        }
      }

      await webhookStatus.save();
    } catch (error: any) {}
  }

  /**
   * Handle video completion webhook
   */
  async handleVideoComplete(data: VideoCompleteData): Promise<WebhookResult> {
    const { videoId, status, scheduleId, trendIndex } = data;
    let finalStatus = status;
    let updatedVideo = null;

    try {
      // Update video status in database
      if (videoId) {
        updatedVideo = await this.videoService.updateVideoStatus(
          videoId,
          status as "processing" | "ready" | "failed"
        );
      }

      // Handle scheduled video completion
      if (scheduleId && trendIndex !== undefined) {
        // Update schedule status
        await this.videoScheduleService.updateVideoStatus(
          scheduleId,
          trendIndex,
          finalStatus as "completed" | "failed",
          videoId
        );

        // If video is completed, store captions and auto-post
        if (finalStatus === "ready" && updatedVideo) {
          try {
            // Get the schedule to retrieve captions
            const VideoSchedule = require("../models/VideoSchedule").default;
            const schedule = await VideoSchedule.findById(scheduleId);

            if (schedule && schedule.generatedTrends[trendIndex]) {
              const trend = schedule.generatedTrends[trendIndex];

              // Store captions from schedule in video record
              const captionsFromSchedule = {
                instagram_caption: trend.instagram_caption,
                facebook_caption: trend.facebook_caption,
                linkedin_caption: trend.linkedin_caption,
                twitter_caption: trend.twitter_caption,
                tiktok_caption: trend.tiktok_caption,
                youtube_caption: trend.youtube_caption,
              };

              await this.videoService.updateVideoCaptions(
                videoId,
                captionsFromSchedule
              );

              // Auto post to social media platforms
              try {
                const postingResults =
                  await this.autoSocialPostingService.postVideoToSocialMedia({
                    userId: schedule.userId.toString(),
                    scheduleId: scheduleId,
                    trendIndex: trendIndex,
                    videoUrl: updatedVideo.videoUrl,
                    videoTitle: trend.description,
                  });

                // Log posting results
                const successfulPosts = postingResults.filter((r) => r.success);
                const failedPosts = postingResults.filter((r) => !r.success);

                if (successfulPosts.length > 0) {
                }

                if (failedPosts.length > 0) {
                }
              } catch (postingError) {
                // Don't fail the webhook if social posting fails
              }
            }
          } catch (captionError) {
            // Don't fail the webhook if caption storage fails
          }
        }
      }

      // Process dynamic generation for manual videos (non-scheduled)
      // Trigger caption generation asynchronously after n8n webhook completes (second hook)
      // This happens regardless of video status (processing/ready) - captions generate in background
      if (updatedVideo && !scheduleId) {
        try {
          // Only track if video is ready (for webhook tracking system)
          if (finalStatus === "ready") {
            await this.trackWebhookCompletion(
              videoId,
              "video",
              updatedVideo.email,
              updatedVideo.title
            );
          }
        } catch (trackingError) {
          // Don't fail the webhook if tracking fails
        }

        // Trigger caption generation asynchronously after webhook response
        // This happens after n8n webhook completes (second hook), even if video is still processing
        (async () => {
          try {
            await this.postWebhookDynamicGenerationService.processDynamicGenerationForVideo(
              videoId,
              updatedVideo.email,
              updatedVideo.title
            );
          } catch (captionError) {
            // Don't fail the webhook response if caption generation fails
          }
        })();
      }

      return buildWebhookResult(
        true,
        "Video completion processed successfully",
        {
          videoId,
          status: finalStatus,
          scheduleId,
          trendIndex,
        }
      );
    } catch (error: any) {
      return buildWebhookResult(
        false,
        `Video completion processing failed: ${error.message}`,
        null
      );
    }
  }

  /**
   * Handle caption completion webhook
   */
  async handleCaptionComplete(data: {
    videoId: string;
    status: string;
    email?: string;
    title?: string;
  }): Promise<WebhookResult> {
    const { videoId, status, email, title } = data;

    try {
      // If email and title are provided, track caption webhook completion
      if (email && title) {
        await this.trackWebhookCompletion(videoId, "caption", email, title);
      } else {
      }

      return buildWebhookResult(
        true,
        "Caption completion processed successfully",
        {
          videoId,
          status,
        }
      );
    } catch (error: any) {
      return buildWebhookResult(
        false,
        `Caption completion processing failed: ${error.message}`,
        null
      );
    }
  }

  /**
   * Handle video completion webhook (legacy method for v1 compatibility)
   */
  async handleVideoCompleteLegacy(data: any): Promise<any> {
    try {
      const { videoId, status = "ready", s3Key, metadata, error } = data;

      validateVideoId(videoId);

      // If there's an error, mark video as failed
      const finalStatus = error ? "failed" : status;

      // Update video status
      const updatedVideo = await this.videoService.updateVideoStatus(
        videoId,
        finalStatus
      );
      if (!updatedVideo) {
        throw new Error("Video not found");
      }

      // Update metadata if provided
      if (metadata) {
        await this.videoService.updateVideoMetadata(videoId, metadata);
      }

      return buildWebhookResult(
        true,
        `Video ${
          finalStatus === "ready" ? "completed" : "failed"
        } successfully`,
        {
          videoId,
          status: finalStatus,
        }
      );
    } catch (error: any) {
      return buildWebhookResult(
        false,
        `Video completion processing failed: ${error.message}`,
        null
      );
    }
  }
}

export default WebhookService;
