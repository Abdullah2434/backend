import https from "https";
import url from "url";
import DefaultAvatar from "../../../models/avatar";
import DefaultVoice from "../../../models/voice";
import { logger } from "../../../core/utils/logger";
import {
  VideoGenerationRequest,
  GenerateVideoRequest,
} from "../types/video.types";

export class VideoGenerationService {
  /**
   * Create video via webhook
   */
  async createVideo(request: VideoGenerationRequest): Promise<any> {
    const webhookUrl = process.env.VIDEO_CREATION_WEBHOOK_URL;

    if (!webhookUrl) {
      throw new Error("VIDEO_CREATION_WEBHOOK_URL is not configured");
    }

    const webhookData = {
      ...request,
      zipCode: 90014,
      zipKeyPoints: "new bars and restaurants",
      timestamp: new Date().toISOString(),
      requestId: `video_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
    };

    return await this.sendWebhookRequest(webhookUrl, webhookData);
  }

  /**
   * Generate video via n8n webhook
   */
  async generateVideo(request: GenerateVideoRequest): Promise<void> {
    const webhookUrl = process.env.GENERATE_VIDEO_WEBHOOK_URL;

    if (!webhookUrl) {
      throw new Error("GENERATE_VIDEO_WEBHOOK_URL is not configured");
    }

    // Get avatar gender for voice matching
    const avatarDoc = await DefaultAvatar.findOne({
      avatar_id: request.avatar_title,
    });

    const gender = avatarDoc?.gender;
    let voice_id: string | undefined;

    if (gender) {
      const voiceDoc = await DefaultVoice.findOne({ gender });
      voice_id = voiceDoc?.voice_id;
    }

    const webhookData = {
      hook: request.hook,
      body: request.body,
      conclusion: request.conclusion,
      company_name: request.company_name,
      social_handles: request.social_handles,
      license: request.license,
      avatar_body: request.avatar_body,
      avatar_conclusion: request.avatar_conclusion,
      avatar_title: request.avatar_title,
      email: request.email,
      title: request.title,
      voice: voice_id,
      isDefault: avatarDoc?.default,
      timestamp: new Date().toISOString(),
    };

    // Fire and forget - don't wait for response
    this.sendWebhookRequestFireAndForget(webhookUrl, webhookData);
  }

  /**
   * Send webhook request and wait for response
   */
  private async sendWebhookRequest(
    webhookUrl: string,
    data: any
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
          let result;
          try {
            result = JSON.parse(responseData);
          } catch {
            result = responseData;
          }

          if (
            res.statusCode &&
            (res.statusCode < 200 || res.statusCode >= 300)
          ) {
            reject(new Error(`Webhook error: ${res.statusCode}`));
          } else {
            resolve(result);
          }
        });
      });

      req.on("error", (error) => {
        logger.error("Webhook request failed", error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Send webhook request without waiting for response (fire and forget)
   */
  private sendWebhookRequestFireAndForget(webhookUrl: string, data: any): void {
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
      res.on("data", () => {}); // Ignore data
      res.on("end", () => {
        logger.info("Webhook request sent successfully", {
          status: res.statusCode,
        });
      });
    });

    req.on("error", (error) => {
      logger.error("Webhook request failed", error);
    });

    req.write(postData);
    req.end();
  }
}

export const videoGenerationService = new VideoGenerationService();
