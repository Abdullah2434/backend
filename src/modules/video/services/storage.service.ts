import { getS3 } from "../../../services/s3";
import { logger } from "../../../core/utils/logger";

export class VideoStorageService {
  /**
   * Get signed download URL for a video
   */
  async getDownloadUrl(
    videoKey: string,
    secretKey: string = ""
  ): Promise<string> {
    try {
      const s3 = getS3();
      const result = await s3.createDownloadUrl(videoKey, secretKey, 3600);
      return result.downloadUrl;
    } catch (error) {
      logger.error("Error getting download URL", error);
      throw error;
    }
  }

  /**
   * Upload video to S3
   */
  async uploadVideo(
    buffer: Buffer,
    key: string,
    contentType: string = "video/mp4",
    metadata: Record<string, string> = {}
  ): Promise<string> {
    try {
      const s3 = getS3();
      await s3.uploadVideoDirectly(key, buffer, contentType, metadata);
      return s3.getVideoUrl(key);
    } catch (error) {
      logger.error("Error uploading video", error);
      throw error;
    }
  }

  /**
   * Delete video from S3
   */
  async deleteVideo(videoKey: string, secretKey: string = ""): Promise<void> {
    try {
      const s3 = getS3();
      await s3.deleteVideo(videoKey, secretKey);
      logger.info(`Video deleted from S3: ${videoKey}`);
    } catch (error) {
      logger.error("Error deleting video", error);
      throw error;
    }
  }

  /**
   * Download video from external URL
   */
  async downloadFromUrl(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error("Error downloading video from URL", error);
      throw error;
    }
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(videoKey: string): Promise<any> {
    try {
      const s3 = getS3();
      const { S3Client, HeadObjectCommand } = await import(
        "@aws-sdk/client-s3"
      );
      const cmd = new HeadObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET?.split("/")[0] || "",
        Key: videoKey,
      });
      // Access the private client through the service
      return await (s3 as any).client.send(cmd);
    } catch (error) {
      logger.error("Error getting video metadata", error);
      throw error;
    }
  }
}

export const videoStorageService = new VideoStorageService();
