import * as https from "https";
import * as url from "url";
import {
  VideoCreationData,
  VideoGenerationData,
  VideoConfig,
  VideoError,
  WebhookError,
} from "../types/video.types";
import {
  generateVideoId,
  logVideoEvent,
  logVideoError,
} from "../utils/video.utils";

export class VideoCreationService {
  private readonly config: VideoConfig;

  constructor() {
    this.config = {
      webhookUrl: process.env.VIDEO_CREATION_WEBHOOK_URL || "",
      generateWebhookUrl: process.env.GENERATE_VIDEO_WEBHOOK_URL || "",
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 10,
      maxVideoSize: 100 * 1024 * 1024, // 100MB
      maxTitleLength: 200,
      maxPromptLength: 1000,
    };

    if (!this.config.webhookUrl) {
      throw new Error(
        "VIDEO_CREATION_WEBHOOK_URL environment variable is required"
      );
    }
  }

  // ==================== VIDEO CREATION ====================

  async createVideo(creationData: VideoCreationData): Promise<{
    requestId: string;
    webhookResponse: any;
    timestamp: string;
    status: string;
  }> {
    try {
      const webhookData = {
        prompt: creationData.prompt,
        avatar: creationData.avatar,
        name: creationData.name,
        position: creationData.position,
        companyName: creationData.companyName,
        license: creationData.license,
        tailoredFit: creationData.tailoredFit,
        socialHandles: creationData.socialHandles,
        videoTopic: creationData.videoTopic,
        topicKeyPoints: creationData.topicKeyPoints,
        city: creationData.city,
        preferredTone: creationData.preferredTone,
        zipCode: 90014,
        zipKeyPoints: "new bars and restaurants",
        callToAction: creationData.callToAction,
        email: creationData.email,
        timestamp: new Date().toISOString(),
        requestId: generateVideoId(),
      };

      const result = await this.sendWebhookRequest(
        this.config.webhookUrl,
        webhookData
      );

      logVideoEvent("video_creation_requested", {
        requestId: webhookData.requestId,
        email: creationData.email,
      });

      return {
        requestId: webhookData.requestId,
        webhookResponse: result,
        timestamp: webhookData.timestamp,
        status: "pending",
      };
    } catch (error) {
      logVideoError(error as Error, { creationData, action: "createVideo" });
      throw new VideoError("Failed to create video", 500);
    }
  }

  // ==================== VIDEO GENERATION ====================

  async generateVideo(generationData: VideoGenerationData): Promise<{
    status: string;
    timestamp: string;
    estimated_completion: string;
    note: string;
  }> {
    try {
      // Import DefaultAvatar and DefaultVoice here to avoid circular dependencies
      const DefaultAvatar = (await import("../../../models/avatar")).default;
      const DefaultVoice = (await import("../../../models/voice")).default;

      // Get gender from DefaultAvatar
      const avatarDoc = await DefaultAvatar.findOne({
        avatar_id: generationData.avatar_title,
      });

      const gender = avatarDoc ? avatarDoc.gender : undefined;

      // Get voice_id from DefaultVoice by gender
      let voice_id: string | undefined = undefined;
      if (gender) {
        const voiceDoc = await DefaultVoice.findOne({ gender });
        voice_id = voiceDoc ? voiceDoc.voice_id : undefined;
      }

      const webhookData = {
        hook: generationData.hook,
        body: generationData.body,
        conclusion: generationData.conclusion,
        company_name: generationData.company_name,
        social_handles: generationData.social_handles,
        license: generationData.license,
        avatar_title: generationData.avatar_title,
        avatar_body: generationData.avatar_body,
        avatar_conclusion: generationData.avatar_conclusion,
        email: generationData.email,
        title: generationData.title,
        voice: voice_id,
        isDefault: avatarDoc?.default,
        timestamp: new Date().toISOString(),
      };

      // Fire and forget: send request to webhook
      this.sendWebhookRequest(
        this.config.generateWebhookUrl,
        webhookData,
        true
      );

      logVideoEvent("video_generation_requested", {
        email: generationData.email,
        title: generationData.title,
      });

      return {
        status: "processing",
        timestamp: new Date().toISOString(),
        estimated_completion: new Date(
          Date.now() + 15 * 60 * 1000
        ).toISOString(),
        note: "Video generation is running in the background. The video will be available when ready.",
      };
    } catch (error) {
      logVideoError(error as Error, {
        generationData,
        action: "generateVideo",
      });
      throw new VideoError("Failed to generate video", 500);
    }
  }

  // ==================== UTILITY METHODS ====================

  private async sendWebhookRequest(
    webhookUrl: string,
    data: any,
    fireAndForget: boolean = false
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(webhookUrl);
      const postData = JSON.stringify(data);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        port: parsedUrl.port || 443,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          try {
            const result = JSON.parse(responseData);
            if (fireAndForget) {
              resolve(result);
            } else if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              resolve(result);
            } else {
              reject(new WebhookError(`Webhook error: ${res.statusCode}`));
            }
          } catch (parseError) {
            if (fireAndForget) {
              resolve(responseData);
            } else {
              reject(new WebhookError("Invalid webhook response"));
            }
          }
        });
      });

      req.on("error", (error) => {
        reject(new WebhookError(`Webhook request failed: ${error.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  // ==================== CONFIGURATION ====================

  getConfig(): VideoConfig {
    return { ...this.config };
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      webhook: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      const webhookAvailable = !!(
        this.config.webhookUrl && this.config.generateWebhookUrl
      );

      return {
        status: webhookAvailable ? "healthy" : "unhealthy",
        services: {
          webhook: webhookAvailable ? "available" : "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          webhook: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default VideoCreationService;
