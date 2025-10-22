
import VideoService from "./video.service";
import { VideoCompleteData, WebhookResult } from "../types";
import VideoScheduleService from "./videoSchedule.service";
import AutoSocialPostingService from "./autoSocialPosting.service";

export class WebhookService {
  private videoService: VideoService;
  private videoScheduleService: VideoScheduleService;
  private autoSocialPostingService: AutoSocialPostingService;

  constructor() {
    this.videoService = new VideoService();
    this.videoScheduleService = new VideoScheduleService();
    this.autoSocialPostingService = new AutoSocialPostingService();
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
        user_id: payload.user_id
      };

      // Add user information if available
      if (user) {
        webhookPayload.user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        };
      }

      console.log(`Sending webhook to ${webhookUrl}:`, webhookPayload);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VideoAvatar-Webhook/1.0',
          'X-Webhook-Signature': this.generateWebhookSignature(webhookPayload)
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json().catch(() => ({}));

      return {
        success: true,
        message: 'Webhook sent successfully',
        data: responseData
      };
    } catch (error: any) {
      console.error('Error sending webhook:', error);
      return {
        success: false,
        message: `Webhook failed: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * Generate webhook signature for security
   */
  private generateWebhookSignature(payload: any): string {
    const secret = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      const expectedSignature = this.generateWebhookSignature(payload);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
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
      console.error('Error processing webhook with auth:', error);
      return {
        success: false,
        message: `Webhook processing failed: ${error.message}`,
        data: null
      };
    }
  }

      // If video is completed, store captions and auto-post
      if (finalStatus === "ready" && updatedVideo) {
        try {
          // Get the schedule to retrieve captions
          const VideoSchedule = require("../models/VideoSchedule").default;
          const schedule = await VideoSchedule.findById(scheduleId);

          if (schedule && schedule.generatedTrends[trendIndex]) {
            const trend = schedule.generatedTrends[trendIndex];

            // Use existing captions from schedule instead of generating new ones
            console.log("📋 Using existing captions from schedule database...");
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
              `  📱 Twitter: ${trend.twitter_caption ? "Available" : "Missing"}`
            );
            console.log(
              `  📱 TikTok: ${trend.tiktok_caption ? "Available" : "Missing"}`
            );
            console.log(
              `  📱 YouTube: ${trend.youtube_caption ? "Available" : "Missing"}`
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
  }

  /**
   * Handle video completion webhook (legacy method for v1 compatibility)
   */
  async handleVideoComplete(data: any): Promise<any> {
    try {
      const { videoId, status = 'ready', s3Key, metadata, error } = data;
      
      if (!videoId) {
        throw new Error('Video ID is required');
      }

      // If there's an error, mark video as failed
      const finalStatus = error ? 'failed' : status;

      // Update video status
      const updatedVideo = await this.videoService.updateVideoStatus(videoId, finalStatus);
      if (!updatedVideo) {
        throw new Error('Video not found');
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
  }
}

export default WebhookService;