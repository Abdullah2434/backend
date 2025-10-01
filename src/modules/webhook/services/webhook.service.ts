import WebhookProcessingService from "./webhook-processing.service";
import {
  StripeWebhookEventData,
  WebhookProcessingResult,
  WebhookConfig,
  WebhookResponse,
} from "../types/webhook.types";
import {
  logWebhookEvent,
  logWebhookError,
  getWebhookConfig,
  maskEventId,
} from "../utils/webhook.utils";
import VideoService from "../../video/services/video.service";

export class WebhookService {
  private readonly processingService: WebhookProcessingService;
  private readonly videoService: VideoService;

  constructor() {
    this.processingService = new WebhookProcessingService();
    this.videoService = new VideoService();
  }

  // ==================== WEBHOOK PROCESSING ====================

  async handleWebhook(
    payload: Buffer,
    signature: string
  ): Promise<WebhookResponse> {
    try {
      // Verify webhook signature
      const event = await this.processingService.verifyWebhookSignature(
        payload,
        signature
      );

      // Check if event was already processed
      const isProcessed = await this.processingService.isEventProcessed(
        event.id
      );
      if (isProcessed) {
        logWebhookEvent("event_already_processed", {
          eventId: maskEventId(event.id),
          eventType: event.type,
        });

        return {
          success: true,
          message: "Event already processed",
          data: {
            eventId: event.id,
            eventType: event.type,
            processed: true,
          },
        };
      }

      // Process the webhook event
      const result = await this.processingService.processWebhookEvent(event);

      // Mark event as processed
      await this.processingService.markEventAsProcessed(event.id);

      if (result.success) {
        return {
          success: true,
          message: "Webhook processed successfully",
          data: {
            eventId: result.eventId,
            eventType: result.eventType,
            processed: result.processed,
            metadata: result.metadata,
          },
        };
      } else {
        return {
          success: false,
          message: "Webhook processing failed",
          data: {
            eventId: result.eventId,
            eventType: result.eventType,
            error: result.error,
            metadata: result.metadata,
          },
        };
      }
    } catch (error) {
      logWebhookError(error as Error, { action: "handleWebhook" });

      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Webhook processing failed",
      };
    }
  }

  // ==================== EVENT MANAGEMENT ====================

  async processEvent(
    event: StripeWebhookEventData
  ): Promise<WebhookProcessingResult> {
    return this.processingService.processWebhookEvent(event);
  }

  async verifySignature(
    payload: Buffer,
    signature: string
  ): Promise<StripeWebhookEventData> {
    return this.processingService.verifyWebhookSignature(payload, signature);
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    return this.processingService.isEventProcessed(eventId);
  }

  async markEventAsProcessed(eventId: string): Promise<void> {
    return this.processingService.markEventAsProcessed(eventId);
  }

  // ==================== CONFIGURATION ====================

  getConfig(): WebhookConfig {
    return this.processingService.getConfig();
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      processing: any;
    };
    timestamp: string;
  }> {
    try {
      const processingHealth = await this.processingService.healthCheck();

      const overallStatus =
        processingHealth.status === "healthy" ? "healthy" : "unhealthy";

      return {
        status: overallStatus,
        services: {
          processing: processingHealth,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          processing: { status: "unhealthy" },
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ==================== LEGACY WEBHOOK METHODS ====================

  async handleVideoComplete(data: any): Promise<any> {
    try {
      const { videoId, status = "ready", s3Key, metadata, error } = data;

      if (!videoId) {
        throw new Error("Video ID is required");
      }

      // If there's an error, mark video as failed
      const finalStatus = error ? "failed" : status;

      // Update video status using the correct interface
      const statusData = {
        videoId,
        status: finalStatus as "processing" | "ready" | "failed",
        metadata,
      };

      const updatedVideo = await this.videoService.updateVideoStatus(
        statusData
      );

      if (!updatedVideo) {
        throw new Error("Video not found");
      }

      // Log S3 key update if provided
      if (s3Key) {
        console.log(
          `Video complete webhook: S3 key updated for video ${videoId}`
        );
      }

      console.log(
        `Video complete webhook: Successfully updated video ${videoId} to status ${finalStatus}`
      );

      return {
        success: true,
        message: "Video status updated successfully",
        data: {
          videoId: updatedVideo.videoId,
          status: updatedVideo.status,
          updatedAt: updatedVideo.updatedAt,
        },
      };
    } catch (error: any) {
      logWebhookError(error, { action: "handleVideoComplete" });
      throw error;
    }
  }
}

export default WebhookService;
