import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import {
  S3ServiceConfig,
  VideoUploadResult,
  VideoDownloadUrlResult,
  S3UploadOptions,
  S3DownloadOptions,
  S3DeleteOptions,
  S3OperationResult,
  S3UploadResult,
  S3DownloadResult,
  S3DeleteResult,
  S3FileInfo,
  S3BatchUploadItem,
  S3BatchUploadResult,
  S3BatchDeleteItem,
  S3BatchDeleteResult,
  S3LogEntry,
} from "../types/s3.types";

export class S3OperationsService {
  private config: S3ServiceConfig;
  private logs: S3LogEntry[] = [];

  constructor(config: S3ServiceConfig) {
    this.config = config;
  }

  public generateS3Key(
    userId: string,
    videoId: string,
    filename: string
  ): string {
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `videos/${userId}/${videoId}/${timestamp}_${safeFilename}`;
  }

  public async uploadVideoDirectly(
    s3Key: string,
    buffer: Buffer,
    contentType: string,
    metadata: Record<string, string> = {}
  ): Promise<S3UploadResult> {
    const startTime = Date.now();

    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.config.client.send(command);
      const duration = Date.now() - startTime;

      this.logOperation(
        "upload",
        s3Key,
        true,
        `Video uploaded successfully`,
        duration
      );

      return {
        success: true,
        message: "Video uploaded successfully",
        s3Key,
        data: { size: buffer.length, contentType },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logOperation(
        "upload",
        s3Key,
        false,
        `Upload failed: ${error.message}`,
        duration,
        error.message
      );

      return {
        success: false,
        error: error.message,
        s3Key,
      };
    }
  }

  public async createUploadUrl(
    userId: string,
    videoId: string,
    filename: string,
    options: S3UploadOptions = {}
  ): Promise<VideoUploadResult> {
    const s3Key = this.generateS3Key(userId, videoId, filename);
    const secretKey = crypto.randomBytes(32).toString("hex");
    const contentType = options.contentType || "video/mp4";
    const expiresIn = options.expiresIn || 3600;

    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: s3Key,
        ContentType: contentType,
        Metadata: {
          ...options.metadata,
          secretKey,
          userId,
          videoId,
          originalFilename: filename,
        },
      });

      const uploadUrl = await getSignedUrl(this.config.client, command, {
        expiresIn,
      });

      this.logOperation(
        "upload",
        s3Key,
        true,
        `Upload URL created for user ${userId}`,
        undefined,
        undefined,
        userId
      );

      return {
        s3Key,
        secretKey,
        uploadUrl,
      };
    } catch (error: any) {
      this.logOperation(
        "upload",
        s3Key,
        false,
        `Failed to create upload URL: ${error.message}`,
        undefined,
        error.message,
        userId
      );
      throw error;
    }
  }

  public async createDownloadUrl(
    s3Key: string,
    secretKey: string,
    options: S3DownloadOptions = {}
  ): Promise<VideoDownloadUrlResult> {
    const expiresIn = options.expiresIn || 3600;

    try {
      // Check if file exists and verify secret key
      const headCommand = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: s3Key,
      });

      const headResult = await this.config.client.send(headCommand);

      // Verify secret key if provided and metadata exists
      if (
        headResult.Metadata?.secretKey &&
        headResult.Metadata.secretKey !== secretKey
      ) {
        throw new Error("Invalid secret key for video access");
      }

      const downloadCommand = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: s3Key,
      });

      const downloadUrl = await getSignedUrl(
        this.config.client,
        downloadCommand,
        { expiresIn }
      );

      this.logOperation("download", s3Key, true, `Download URL created`);

      return {
        downloadUrl,
        expiresIn,
      };
    } catch (error: any) {
      this.logOperation(
        "download",
        s3Key,
        false,
        `Failed to create download URL: ${error.message}`,
        undefined,
        error.message
      );
      throw error;
    }
  }

  public async deleteVideo(
    s3Key: string,
    options: S3DeleteOptions = {}
  ): Promise<S3DeleteResult> {
    const startTime = Date.now();

    try {
      // Verify secret key if provided
      if (options.secretKey) {
        const headCommand = new HeadObjectCommand({
          Bucket: this.config.bucketName,
          Key: s3Key,
        });

        const headResult = await this.config.client.send(headCommand);

        if (headResult.Metadata?.secretKey !== options.secretKey) {
          throw new Error("Invalid secret key for video deletion");
        }
      }

      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: s3Key,
      });

      await this.config.client.send(deleteCommand);
      const duration = Date.now() - startTime;

      this.logOperation(
        "delete",
        s3Key,
        true,
        `Video deleted successfully`,
        duration
      );

      return {
        success: true,
        message: "Video deleted successfully",
        deleted: true,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logOperation(
        "delete",
        s3Key,
        false,
        `Delete failed: ${error.message}`,
        duration,
        error.message
      );

      return {
        success: false,
        error: error.message,
        deleted: false,
      };
    }
  }

  public async getFileInfo(s3Key: string): Promise<S3FileInfo | null> {
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: s3Key,
      });

      const result = await this.config.client.send(headCommand);

      this.logOperation("head", s3Key, true, `File info retrieved`);

      return {
        key: s3Key,
        size: result.ContentLength || 0,
        lastModified: result.LastModified || new Date(),
        contentType: result.ContentType,
        metadata: result.Metadata,
        etag: result.ETag,
      };
    } catch (error: any) {
      this.logOperation(
        "head",
        s3Key,
        false,
        `Failed to get file info: ${error.message}`,
        undefined,
        error.message
      );
      return null;
    }
  }

  public getVideoUrl(s3Key: string): string {
    return `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${s3Key}`;
  }

  public async batchUpload(
    items: S3BatchUploadItem[]
  ): Promise<S3BatchUploadResult> {
    const results: Array<{ s3Key: string; success: boolean; error?: string }> =
      [];
    let successfulItems = 0;
    let failedItems = 0;

    for (const item of items) {
      try {
        const result = await this.uploadVideoDirectly(
          item.s3Key,
          item.buffer,
          item.contentType,
          item.metadata
        );

        results.push({
          s3Key: item.s3Key,
          success: result.success,
          error: result.error,
        });

        if (result.success) {
          successfulItems++;
        } else {
          failedItems++;
        }
      } catch (error: any) {
        results.push({
          s3Key: item.s3Key,
          success: false,
          error: error.message,
        });
        failedItems++;
      }
    }

    return {
      success: failedItems === 0,
      results,
      totalItems: items.length,
      successfulItems,
      failedItems,
    };
  }

  public async batchDelete(
    items: S3BatchDeleteItem[]
  ): Promise<S3BatchDeleteResult> {
    const results: Array<{ s3Key: string; success: boolean; error?: string }> =
      [];
    let successfulItems = 0;
    let failedItems = 0;

    for (const item of items) {
      try {
        const result = await this.deleteVideo(item.s3Key, {
          secretKey: item.secretKey,
        });

        results.push({
          s3Key: item.s3Key,
          success: result.success,
          error: result.error,
        });

        if (result.success) {
          successfulItems++;
        } else {
          failedItems++;
        }
      } catch (error: any) {
        results.push({
          s3Key: item.s3Key,
          success: false,
          error: error.message,
        });
        failedItems++;
      }
    }

    return {
      success: failedItems === 0,
      results,
      totalItems: items.length,
      successfulItems,
      failedItems,
    };
  }

  public getLogs(limit: number = 100): S3LogEntry[] {
    return this.logs.slice(-limit);
  }

  public clearLogs(): void {
    this.logs = [];
  }

  private logOperation(
    operation: "upload" | "download" | "delete" | "list" | "head" | "error",
    s3Key: string,
    success: boolean,
    message: string,
    duration?: number,
    error?: string,
    userId?: string
  ): void {
    const logEntry: S3LogEntry = {
      timestamp: new Date(),
      operation,
      s3Key,
      userId,
      success,
      message,
      error,
      duration,
    };

    this.logs.push(logEntry);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    const level = success ? "INFO" : "ERROR";
    console.log(
      `[S3Operations] ${level}: ${operation.toUpperCase()} - ${message}`,
      {
        s3Key,
        userId,
        duration,
        error,
      }
    );
  }
}
