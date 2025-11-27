import { VideoService } from "../video";
import {
  VideoCompleteData,
  WebhookResult,
  WebhookRequest,
  WebhookResponse,
} from "../../types";
import VideoScheduleService from "../videoSchedule";
import AutoSocialPostingService from "../autoSocialPosting.service";
import { PostWebhookDynamicGenerationService } from "./postWebhookDynamicGeneration.service";
import VideoWebhookStatus from "../../models/VideoWebhookStatus";
import VideoSchedule from "../../models/VideoSchedule";
import {
  buildWebhookPayload,
  buildWebhookHeaders,
  buildSuccessWebhookResponse,
  buildErrorWebhookResponse,
  buildWebhookResult,
  validateVideoId,
  verifyWebhookSignature as verifySignature,
} from "../../utils/webhookHelpers";
import {
  generateKeypointsFromTitle,
  extractCaptionsFromTrend,
} from "../../utils/webhookServiceHelpers";
import { WEBHOOK_TYPES } from "../../constants/postWebhookDynamicGeneration.constants";

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
      const webhookPayload = buildWebhookPayload(payload, user);
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
      const webhookStatus = await this.getOrCreateWebhookStatus(
        videoId,
        email,
        title
      );

      this.updateWebhookCompletionStatus(webhookStatus, webhookType);

      const bothCompleted =
        webhookStatus.videoWebhookCompleted &&
        webhookStatus.captionWebhookCompleted;

      if (bothCompleted && !webhookStatus.allWebhooksCompleted) {
        await this.handleAllWebhooksCompleted(
          webhookStatus,
          videoId,
          email,
          title
        );
      }

      await webhookStatus.save();
    } catch (error: any) {
      // Silently handle tracking errors to not break webhook flow
    }
  }

  /**
   * Get or create webhook status record
   */
  private async getOrCreateWebhookStatus(
    videoId: string,
    email: string,
    title: string
  ): Promise<any> {
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

    return webhookStatus;
  }

  /**
   * Update webhook completion status based on type
   */
  private updateWebhookCompletionStatus(
    webhookStatus: any,
    webhookType: "video" | "caption"
  ): void {
    if (webhookType === WEBHOOK_TYPES.VIDEO) {
      webhookStatus.videoWebhookCompleted = true;
      webhookStatus.videoWebhookCompletedAt = new Date();
    } else if (webhookType === WEBHOOK_TYPES.CAPTION) {
      webhookStatus.captionWebhookCompleted = true;
      webhookStatus.captionWebhookCompletedAt = new Date();
    }
  }

  /**
   * Handle when all webhooks are completed
   */
  private async handleAllWebhooksCompleted(
    webhookStatus: any,
    videoId: string,
    email: string,
    title: string
  ): Promise<void> {
    webhookStatus.allWebhooksCompleted = true;
    webhookStatus.allWebhooksCompletedAt = new Date();

    await this.postWebhookDynamicGenerationService.processDynamicGenerationForVideo(
      videoId,
      email,
      title
    );

    // Generate keypoints from title asynchronously (non-blocking)
    await generateKeypointsFromTitle(title, email).catch(() => {
      // Silently handle keypoints generation errors
    });
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
      if (scheduleId && trendIndex !== undefined && videoId && finalStatus) {
        await this.handleScheduledVideoCompletion(
          scheduleId,
          trendIndex,
          finalStatus,
          videoId,
          updatedVideo
        );
      }

      // Process dynamic generation for manual videos (non-scheduled)
      if (updatedVideo && !scheduleId && videoId && finalStatus) {
        await this.handleManualVideoCompletion(
          videoId,
          finalStatus,
          updatedVideo
        );
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
        await this.trackWebhookCompletion(
          videoId,
          WEBHOOK_TYPES.CAPTION,
          email,
          title
        );
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

  /**
   * Handle scheduled video completion
   */
  private async handleScheduledVideoCompletion(
    scheduleId: string,
    trendIndex: number,
    finalStatus: string,
    videoId: string,
    updatedVideo: any
  ): Promise<void> {
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
        const schedule = await VideoSchedule.findById(scheduleId);

        if (schedule?.generatedTrends[trendIndex]) {
          const trend = schedule.generatedTrends[trendIndex];
          const captionsFromSchedule = extractCaptionsFromTrend(trend);

          await this.videoService.updateVideoCaptions(
            videoId,
            captionsFromSchedule
          );

          // Auto post to social media platforms
          await this.autoPostScheduledVideo(
            schedule,
            trendIndex,
            updatedVideo,
            trend.description
          );
        }
      } catch (error) {
        // Don't fail the webhook if caption storage or posting fails
      }
    }
  }

  /**
   * Auto post scheduled video to social media
   */
  private async autoPostScheduledVideo(
    schedule: any,
    trendIndex: number,
    updatedVideo: any,
    videoTitle: string
  ): Promise<void> {
    try {
      await this.autoSocialPostingService.postVideoToSocialMedia({
        userId: schedule.userId.toString(),
        scheduleId: schedule._id.toString(),
        trendIndex: trendIndex,
        videoUrl: updatedVideo.videoUrl,
        videoTitle: videoTitle,
      });
    } catch (postingError) {
      // Don't fail the webhook if social posting fails
    }
  }

  /**
   * Handle manual video completion (non-scheduled)
   */
  private async handleManualVideoCompletion(
    videoId: string,
    finalStatus: string,
    updatedVideo: any
  ): Promise<void> {
    // Only track if video is ready (for webhook tracking system)
    if (finalStatus === "ready") {
      try {
        await this.trackWebhookCompletion(
          videoId,
          WEBHOOK_TYPES.VIDEO,
          updatedVideo.email,
          updatedVideo.title
        );
      } catch (trackingError) {
        // Don't fail the webhook if tracking fails
      }
    }

    // Trigger caption generation asynchronously after webhook response
    // This happens after n8n webhook completes (second hook), even if video is still processing
    this.postWebhookDynamicGenerationService
      .processDynamicGenerationForVideo(
        videoId,
        updatedVideo.email,
        updatedVideo.title
      )
      .catch(() => {
        // Don't fail the webhook response if caption generation fails
      });
  }
}

export default WebhookService;
