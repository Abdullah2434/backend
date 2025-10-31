import VideoService from "./video.service";
import {
  VideoCompleteData,
  WebhookResult,
  WebhookRequest,
  WebhookResponse,
  VideoAvatarCallbackPayload,
} from "../types";
import VideoScheduleService from "./videoSchedule.service";
import AutoSocialPostingService from "./autoSocialPosting.service";
import PostWebhookDynamicGenerationService from "./postWebhookDynamicGeneration.service";
import VideoWebhookStatus from "../models/VideoWebhookStatus";
import { generateFromDescription } from "./trends.service";
import * as crypto from "crypto";

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
      const webhookPayload: VideoAvatarCallbackPayload = {
        avatar_id: payload.avatar_id,
        status: payload.status,
        avatar_group_id: payload.avatar_group_id,
        callback_id: payload.callback_id,
        user_id: payload.user_id,
      };

      // Add user information if available
      if (user) {
        webhookPayload.user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }

      console.log(`Sending webhook to ${webhookUrl}:`, webhookPayload);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "VideoAvatar-Webhook/1.0",
          "X-Webhook-Signature": this.generateWebhookSignature(webhookPayload),
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        throw new Error(
          `Webhook failed: ${response.status} ${response.statusText}`
        );
      }

      const responseData = await response.json().catch(() => ({}));

      return {
        success: true,
        message: "Webhook sent successfully",
        data: responseData,
      };
    } catch (error: any) {
      console.error("Error sending webhook:", error);
      return {
        success: false,
        message: `Webhook failed: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Generate webhook signature for security
   */
  private generateWebhookSignature(payload: any): string {
    const secret = process.env.WEBHOOK_SECRET || "default-webhook-secret";
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac("sha256", secret)
      .update(payloadString)
      .digest("hex");
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      const expectedSignature = this.generateWebhookSignature(payload);
      return crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch (error) {
      console.error("Error verifying webhook signature:", error);
      return false;
    }
  }

  /**
   * Validate user token (placeholder implementation)
   */
  private async validateUserToken(token: string): Promise<any> {
    // This is a placeholder implementation
    // In a real application, you would validate the JWT token here
    console.log("Validating user token:", token);
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
      console.error("Error processing webhook with auth:", error);
      return {
        success: false,
        message: `Webhook processing failed: ${error.message}`,
        data: null,
      };
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
      console.log(
        `📊 Tracking ${webhookType} webhook completion for video: ${videoId}`
      );

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

        console.log(`🎉 Both webhooks completed for video: ${videoId}`);
        console.log(
          `🔄 Triggering dynamic generation for video: ${videoId} (video may still be processing)`
        );

        // Trigger dynamic generation immediately when second webhook arrives
        // This happens even if video is still in "processing" status
        await this.postWebhookDynamicGenerationService.processDynamicGenerationForVideo(
          videoId,
          email,
          title
        );

        // Call trends API to generate keypoints from description (video title)
        try {
          console.log(
            `📊 Calling trends API for keypoints generation: ${title}`
          );

          // Get city from UserVideoSettings using email
          const UserVideoSettings =
            require("../models/UserVideoSettings").default;
          const userSettings = await UserVideoSettings.findOne({
            email: email,
          });
          const videoCity = userSettings?.city || null;

          if (videoCity) {
            console.log(`📍 City found in user settings: ${videoCity}`);
          } else {
            console.log(
              `📍 No city found in user settings, proceeding without city`
            );
          }

          // Call generateFromDescription API with video title as description
          const keypointsResult = await generateFromDescription(
            title,
            videoCity || undefined
          );

          if (keypointsResult && keypointsResult.keypoints) {
            console.log(
              `✅ Generated keypoints from trends API: ${keypointsResult.keypoints}`
            );

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

            console.log(`💾 Keypoints saved for video: ${videoId}`);
          }
        } catch (keypointsError: any) {
          console.error(
            `⚠️ Error generating keypoints from trends API for video ${videoId}:`,
            keypointsError
          );
          // Don't fail the webhook if keypoints generation fails
        }
      }

      await webhookStatus.save();

      console.log(`📊 Webhook status updated for video ${videoId}:`);
      console.log(
        `  📹 Video webhook: ${
          webhookStatus.videoWebhookCompleted ? "✅" : "⏳"
        }`
      );
      console.log(
        `  📝 Caption webhook: ${
          webhookStatus.captionWebhookCompleted ? "✅" : "⏳"
        }`
      );
      console.log(
        `  🎯 All webhooks: ${webhookStatus.allWebhooksCompleted ? "✅" : "⏳"}`
      );
    } catch (error: any) {
      console.error(
        `❌ Error tracking webhook completion for video ${videoId}:`,
        error
      );
    }
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
        console.log(`Video ${videoId} status updated to: ${status}`);
      }

      // Handle scheduled video completion
      if (scheduleId && trendIndex !== undefined) {
        console.log(
          `🎬 Processing scheduled video completion: ${videoId} for schedule ${scheduleId}, trend ${trendIndex}`
        );

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

              // Use existing captions from schedule instead of generating new ones
              console.log(
                "📋 Using existing captions from schedule database..."
              );
              console.log("📋 Available captions in schedule:");
              console.log(
                `  📱 Instagram: ${
                  trend.instagram_caption ? "Available" : "Missing"
                }`
              );
              console.log(
                `  📱 Facebook: ${
                  trend.facebook_caption ? "Available" : "Missing"
                }`
              );
              console.log(
                `  📱 LinkedIn: ${
                  trend.linkedin_caption ? "Available" : "Missing"
                }`
              );
              console.log(
                `  📱 Twitter: ${
                  trend.twitter_caption ? "Available" : "Missing"
                }`
              );
              console.log(
                `  📱 TikTok: ${trend.tiktok_caption ? "Available" : "Missing"}`
              );
              console.log(
                `  📱 YouTube: ${
                  trend.youtube_caption ? "Available" : "Missing"
                }`
              );

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
              console.log(
                `✅ Captions from schedule stored for video ${videoId}`
              );

              // Auto post to social media platforms
              try {
                console.log(
                  `🚀 Starting auto social media posting for scheduled video ${videoId}`
                );
                console.log(`📋 Video URL: ${updatedVideo.videoUrl}`);
                console.log(`📋 Video Title: ${trend.description}`);
                console.log(`📋 User ID: ${schedule.userId}`);
                console.log(`📋 Schedule ID: ${scheduleId}`);
                console.log(`📋 Trend Index: ${trendIndex}`);

                const postingResults =
                  await this.autoSocialPostingService.postVideoToSocialMedia({
                    userId: schedule.userId.toString(),
                    scheduleId: scheduleId,
                    trendIndex: trendIndex,
                    videoUrl: updatedVideo.videoUrl,
                    videoTitle: trend.description,
                  });

                console.log(`📱 Auto social posting results:`, postingResults);

                // Log posting results
                const successfulPosts = postingResults.filter((r) => r.success);
                const failedPosts = postingResults.filter((r) => !r.success);

                if (successfulPosts.length > 0) {
                  console.log(
                    `✅ Successfully posted to ${successfulPosts.length} platforms:`,
                    successfulPosts.map((r) => r.accountName).join(", ")
                  );
                }

                if (failedPosts.length > 0) {
                  console.log(
                    `❌ Failed to post to ${failedPosts.length} platforms:`,
                    failedPosts
                      .map((r) => `${r.accountName} (${r.error})`)
                      .join(", ")
                  );
                }
              } catch (postingError) {
                console.error(
                  `❌ Error in auto social media posting for video ${videoId}:`,
                  postingError
                );
                // Don't fail the webhook if social posting fails
              }
            }
          } catch (captionError) {
            console.error(
              `❌ Error storing captions for video ${videoId}:`,
              captionError
            );
            // Don't fail the webhook if caption storage fails
          }
        }
      }

      // Process dynamic generation for manual videos (non-scheduled)
      // Trigger caption generation asynchronously after n8n webhook completes (second hook)
      // This happens regardless of video status (processing/ready) - captions generate in background
      if (updatedVideo && !scheduleId) {
        try {
          console.log(
            `📊 Tracking video webhook completion for manual video: ${videoId}`
          );
          
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
          console.error(
            `❌ Error tracking webhook completion for video ${videoId}:`,
            trackingError
          );
          // Don't fail the webhook if tracking fails
        }

        // Trigger caption generation asynchronously after webhook response
        // This happens after n8n webhook completes (second hook), even if video is still processing
        (async () => {
          try {
            console.log(
              `🎨 Starting asynchronous caption generation for video: ${videoId} after n8n webhook completion (video status: ${finalStatus})`
            );
            await this.postWebhookDynamicGenerationService.processDynamicGenerationForVideo(
              videoId,
              updatedVideo.email,
              updatedVideo.title
            );
            console.log(
              `✅ Asynchronous caption generation completed for video: ${videoId}`
            );
          } catch (captionError) {
            console.error(
              `❌ Error in asynchronous caption generation for video ${videoId}:`,
              captionError
            );
            // Don't fail the webhook response if caption generation fails
          }
        })();
      }

      return {
        success: true,
        message: "Video completion processed successfully",
        data: {
          videoId,
          status: finalStatus,
          scheduleId,
          trendIndex,
        },
      };
    } catch (error: any) {
      console.error("Error processing video completion:", error);
      return {
        success: false,
        message: `Video completion processing failed: ${error.message}`,
        data: null,
      };
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
      console.log(`📝 Caption webhook received for video: ${videoId}`);

      // If email and title are provided, track caption webhook completion
      if (email && title) {
        await this.trackWebhookCompletion(videoId, "caption", email, title);
      } else {
        console.log(
          `⚠️ Email and title not provided for caption webhook ${videoId}, skipping tracking`
        );
      }

      return {
        success: true,
        message: "Caption completion processed successfully",
        data: {
          videoId,
          status,
        },
      };
    } catch (error: any) {
      console.error("Error processing caption completion:", error);
      return {
        success: false,
        message: `Caption completion processing failed: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * Handle video completion webhook (legacy method for v1 compatibility)
   */
  async handleVideoCompleteLegacy(data: any): Promise<any> {
    try {
      const { videoId, status = "ready", s3Key, metadata, error } = data;

      if (!videoId) {
        throw new Error("Video ID is required");
      }

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

      return {
        success: true,
        message: `Video ${
          finalStatus === "ready" ? "completed" : "failed"
        } successfully`,
        data: {
          videoId,
          status: finalStatus,
        },
      };
    } catch (error: any) {
      console.error("Error processing legacy video completion:", error);
      return {
        success: false,
        message: `Video completion processing failed: ${error.message}`,
        data: null,
      };
    }
  }
}

export default WebhookService;
