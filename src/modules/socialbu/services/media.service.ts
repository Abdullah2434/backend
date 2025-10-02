import axios, { AxiosError } from "axios";
import SocialBuMedia, { ISocialBuMedia } from "../../../models/SocialBuMedia";
import { connectMongo } from "../../../config/mongoose";
import { socialBuAuthService } from "./auth.service";
import { logger } from "../../../core/utils/logger";
import {
  MediaUploadRequest,
  MediaUploadResult,
  MediaUploadStatus,
  SocialBuMediaUpload,
} from "../types/socialbu.types";

/**
 * SocialBu Media Management Service
 * Handles media uploads and tracking
 */
class SocialBuMediaService {
  private static instance: SocialBuMediaService;
  private readonly SOCIALBU_UPLOAD_URL =
    "https://socialbu.com/api/v1/upload_media";

  private constructor() {}

  public static getInstance(): SocialBuMediaService {
    if (!SocialBuMediaService.instance) {
      SocialBuMediaService.instance = new SocialBuMediaService();
    }
    return SocialBuMediaService.instance;
  }

  /**
   * Upload media to SocialBu and execute upload script
   */
  async uploadMedia(
    userId: string,
    mediaData: MediaUploadRequest
  ): Promise<MediaUploadResult> {
    try {
      await connectMongo();

      logger.info("Starting complete media upload workflow for user:", userId);

      // Get valid token
      const tokenString = await socialBuAuthService.getValidToken();
      if (!tokenString) {
        return {
          success: false,
          message: "No valid SocialBu token available",
          error: "Token not found",
        };
      }

      // Call SocialBu upload API
      const response = await axios.post<SocialBuMediaUpload>(
        this.SOCIALBU_UPLOAD_URL,
        {
          name: mediaData.videoName,
          mime_type: mediaData.mimeType || "video/mp4",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${tokenString}`,
          },
        }
      );

      if (response.data) {
        logger.info("SocialBu upload response received, saving to database...");

        // Create media record with API response
        const mediaRecord = new SocialBuMedia({
          userId,
          name: mediaData.videoName,
          mime_type: mediaData.mimeType || "video/mp4",
          socialbuResponse: {
            name: response.data.name,
            mime_type: response.data.mime_type,
            signed_url: response.data.signed_url,
            key: response.data.key,
            secure_key: response.data.secure_key,
            url: response.data.url,
          },
          uploadScript: {
            videoUrl: mediaData.videoUrl,
            executed: false,
            status: "pending",
          },
          status: "pending",
        });

        await mediaRecord.save();
        await mediaRecord.markApiCompleted();

        logger.info("Media upload record saved to database:", mediaRecord._id);

        // Execute upload script
        logger.info("Executing upload script...");
        const scriptResult = await this.executeUploadScript(
          mediaRecord,
          mediaData.videoUrl
        );

        return {
          success: true,
          message: "Complete media upload workflow completed",
          data: {
            mediaId: (scriptResult._id as any).toString(),
            socialbuResponse: scriptResult.socialbuResponse,
            uploadScript: {
              videoUrl: scriptResult.uploadScript.videoUrl,
              status: scriptResult.uploadScript.status,
            },
          },
        };
      }

      return {
        success: false,
        message: "No response data from SocialBu",
        error: "Empty response",
      };
    } catch (error) {
      logger.error("Error in media upload workflow", error);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const message =
          (axiosError.response?.data as any)?.message || axiosError.message;

        return {
          success: false,
          message: `SocialBu API error: ${message}`,
          error: `HTTP ${status}: ${message}`,
        };
      }

      return {
        success: false,
        message: "Failed to upload media",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute upload script to transfer video to SocialBu
   */
  private async executeUploadScript(
    mediaRecord: ISocialBuMedia,
    videoUrl: string
  ): Promise<ISocialBuMedia> {
    try {
      await mediaRecord.markScriptExecuting();

      const startTime = new Date();
      logger.info(`Executing upload for media ${mediaRecord._id}...`);

      // Make PUT request to signed URL
      const uploadResponse = await axios.put(
        mediaRecord.socialbuResponse.signed_url,
        videoUrl,
        {
          headers: {
            "Content-Type": mediaRecord.mime_type,
          },
          maxRedirects: 10,
          validateStatus: (status) =>
            (status >= 200 && status < 300) || status === 307,
        }
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Update media record with script results
      mediaRecord.uploadScript.startTime = startTime;
      mediaRecord.uploadScript.endTime = endTime;
      mediaRecord.uploadScript.duration = duration;
      mediaRecord.uploadScript.response = {
        statusCode: uploadResponse.status,
        headers: uploadResponse.headers,
        success: uploadResponse.status >= 200 && uploadResponse.status < 300,
        finalVideoUrl: mediaRecord.socialbuResponse.url,
      };

      await (mediaRecord as any).markScriptCompleted();

      logger.info(
        `Upload script completed successfully for media ${mediaRecord._id}`
      );

      return mediaRecord;
    } catch (error) {
      logger.error(
        `Error executing upload script for media ${mediaRecord._id}`,
        error
      );

      // Update media record with error
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      mediaRecord.uploadScript.response = {
        statusCode: axios.isAxiosError(error)
          ? error.response?.status || 500
          : 500,
        headers: {},
        success: false,
        errorMessage,
      };
      mediaRecord.status = "failed";
      mediaRecord.errorMessage = errorMessage;

      await mediaRecord.save();

      throw error;
    }
  }

  /**
   * Get upload status for a specific media
   */
  async getUploadStatus(
    userId: string,
    mediaId: string
  ): Promise<MediaUploadStatus | null> {
    try {
      await connectMongo();

      const media = await SocialBuMedia.findOne({ _id: mediaId, userId });

      if (!media) {
        return null;
      }

      return {
        mediaId: media._id.toString(),
        status: media.status,
        socialbuResponse: media.socialbuResponse,
        uploadScript: {
          executed: media.uploadScript.executed,
          status: media.uploadScript.status,
          response: media.uploadScript.response,
        },
      };
    } catch (error) {
      logger.error("Error getting upload status", error);
      return null;
    }
  }

  /**
   * Get all media uploads for a user
   */
  async getUserMedia(userId: string): Promise<ISocialBuMedia[]> {
    try {
      await connectMongo();

      const media = await SocialBuMedia.find({ userId }).sort({
        createdAt: -1,
      });

      return media;
    } catch (error) {
      logger.error("Error getting user media", error);
      return [];
    }
  }

  /**
   * Get active uploads (pending or executing)
   */
  async getActiveUploads(): Promise<ISocialBuMedia[]> {
    try {
      await connectMongo();

      const activeUploads = await SocialBuMedia.find({
        status: { $in: ["pending", "script_executing"] },
      }).sort({ createdAt: -1 });

      return activeUploads;
    } catch (error) {
      logger.error("Error getting active uploads", error);
      return [];
    }
  }
}

export const socialBuMediaService = SocialBuMediaService.getInstance();
