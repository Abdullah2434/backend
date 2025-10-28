import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { S3Config, VideoUploadResult, VideoDownloadUrlResult } from "../types";

export class S3Service {
  private client: S3Client;
  private bucketName: string;
  private region: string;
  constructor(cfg: S3Config) {
    const clientConfig: any = {
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    };
    if (cfg.endpoint) clientConfig.endpoint = cfg.endpoint;
    if (cfg.forcePathStyle) clientConfig.forcePathStyle = cfg.forcePathStyle;
    this.client = new S3Client(clientConfig);
    this.bucketName = cfg.bucketName;
    this.region = cfg.region;
  }
  generateS3Key(userId: string, videoId: string, filename: string) {
    const ts = Date.now();
    const safe = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `videos/${userId}/${videoId}/${ts}_${safe}`;
  }
  async uploadVideoDirectly(
    s3Key: string,
    buf: Buffer,
    contentType: string,
    metadata: Record<string, string>
  ) {
    const cmd = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: buf,
      ContentType: contentType,
      Metadata: metadata,
      ContentLength: buf.byteLength,
    });
    await this.client.send(cmd);
    return true;
  }
  async createUploadUrl(
    userId: string,
    videoId: string,
    filename: string,
    contentType = "video/mp4"
  ): Promise<VideoUploadResult> {
    const s3Key = this.generateS3Key(userId, videoId, filename);
    const secretKey = crypto.randomBytes(32).toString("hex");
    const cmd = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: 3600 });
    return { s3Key, secretKey, uploadUrl };
  }
  async createDownloadUrl(
    s3Key: string,
    secretKey: string,
    expiresIn = 3600
  ): Promise<VideoDownloadUrlResult> {
    const head = new HeadObjectCommand({ Bucket: this.bucketName, Key: s3Key });
    const info = await this.client.send(head);

    // Allow access if S3 metadata is undefined (for existing videos without metadata)
    if (info.Metadata?.secretKey && info.Metadata?.secretKey !== secretKey) {
      throw new Error("Invalid secret key for video access");
    }
    const cmd = new GetObjectCommand({ Bucket: this.bucketName, Key: s3Key });
    const downloadUrl = await getSignedUrl(this.client, cmd, { expiresIn });
    return { downloadUrl, expiresIn };
  }
  async createVideoViewUrl(
    s3Key: string,
    secretKey: string,
    expiresIn = 3600
  ): Promise<{ viewUrl: string; expiresIn: number }> {
    // 1️⃣ Validate secretKey in object metadata (same as your download method)
    const head = new HeadObjectCommand({ Bucket: this.bucketName, Key: s3Key });
    const info = await this.client.send(head);

    if (info.Metadata?.secretkey && info.Metadata?.secretkey !== secretKey) {
      throw new Error("Invalid secret key for video access");
    }

    // 2️⃣ Generate a signed URL for streaming/viewing
    const cmd = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ResponseContentType: "video/mp4", // ensures browser streaming
    });

    const viewUrl = await getSignedUrl(this.client, cmd, { expiresIn });

    return { viewUrl, expiresIn };
  }
  async deleteVideo(s3Key: string, secretKey: string) {
    const head = new HeadObjectCommand({ Bucket: this.bucketName, Key: s3Key });
    const info = await this.client.send(head);
    if (info.Metadata?.secretKey !== secretKey)
      throw new Error("Invalid secret key for video deletion");
    const cmd = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    await this.client.send(cmd);
    return true;
  }
  getVideoUrl(s3Key: string) {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
  }

  /**
   * Generate a signed URL for video avatar files that can be accessed by external services like Heygen
   */
  async getSignedVideoUrl(s3Key: string, expiresIn = 3600): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucketName, Key: s3Key });
    return await getSignedUrl(this.client, cmd, { expiresIn });
  }

  /**
   * Generate S3 key for music tracks
   */
  generateMusicS3Key(
    energyCategory: string,
    trackId: string,
    filename: string
  ): string {
    const ts = Date.now();
    const safe = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `music/${energyCategory}/${trackId}/${ts}_${safe}`;
  }

  /**
   * Upload music track to S3
   */
  async uploadMusicTrack(
    s3Key: string,
    buffer: Buffer,
    contentType: string,
    metadata: Record<string, string>
  ): Promise<boolean> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
      ContentLength: buffer.byteLength,
    });
    await this.client.send(cmd);
    return true;
  }

  /**
   * Upload music preview clip to S3
   */
  async uploadMusicPreview(
    s3Key: string,
    buffer: Buffer,
    contentType: string,
    metadata: Record<string, string>
  ): Promise<boolean> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
      ContentLength: buffer.byteLength,
    });
    await this.client.send(cmd);
    return true;
  }

  /**
   * Generate signed URL for music track access
   */
  async getMusicTrackUrl(s3Key: string, expiresIn = 3600): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucketName, Key: s3Key });
    return await getSignedUrl(this.client, cmd, { expiresIn });
  }

  /**
   * Delete music track from S3
   */
  async deleteMusicTrack(s3Key: string): Promise<boolean> {
    const cmd = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    await this.client.send(cmd);
    return true;
  }

  /**
   * Generate a clean proxy URL for video avatar files
   * This creates a URL that goes through your API instead of directly to S3
   */
  getCleanVideoUrl(s3Key: string, baseUrl?: string): string {
    // Use the actual API base URL from environment or construct it from request
    const apiBaseUrl =
      baseUrl ||
      process.env.API_BASE_URL ||
      process.env.BASE_URL ||
      "http://localhost:3000";

    // Change file extension from .mov to .mp4 for cleaner URLs
    const cleanS3Key = s3Key.replace(/\.mov$/i, ".mp4");

    return `${apiBaseUrl}/api/v2/video_avatar/proxy/${encodeURIComponent(
      cleanS3Key
    )}`;
  }

  /**
   * Get a presigned URL for an S3 object
   */
  async getPresignedUrl(
    Key: string,
    Bucket: string = this.bucketName,
    expiresSeconds: number = 3600
  ): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket, Key });
    return await getSignedUrl(this.client, cmd, { expiresIn: expiresSeconds });
  }

  /**
   * Upload a buffer to S3
   */
  async uploadBuffer({
    Key,
    Body,
    ContentType,
    Bucket = this.bucketName,
  }: {
    Key: string;
    Body: Buffer;
    ContentType: string;
    Bucket?: string;
  }): Promise<string> {
    const cmd = new PutObjectCommand({ Bucket, Key, Body, ContentType });
    await this.client.send(cmd);
    return `https://${Bucket}.s3.${this.region}.amazonaws.com/${Key}`;
  }

  /**
   * Upload a file from disk path to S3 (for streaming large files)
   */
  async uploadVideoFromPath(
    s3Key: string,
    filePath: string,
    contentType: string,
    metadata: Record<string, string>
  ): Promise<boolean> {
    const fs = require("fs");
    const fileStream = fs.createReadStream(filePath);

    const cmd = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: fileStream,
      ContentType: contentType,
      Metadata: metadata,
    });

    await this.client.send(cmd);

    // Clean up the temporary file
    fs.unlink(filePath, (err: any) => {
      if (err) console.error("Error deleting temp file:", err);
    });

    return true;
  }
}

let s3Singleton: S3Service | null = null;
export function getS3() {
  if (!s3Singleton) {
    const bucketEnv = process.env.AWS_S3_BUCKET || "";
    const [bucketName] = bucketEnv.split("/");
    const cfg: S3Config = {
      region: process.env.AWS_REGION || "us-east-1",
      bucketName,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    };
    if (process.env.AWS_S3_ENDPOINT) cfg.endpoint = process.env.AWS_S3_ENDPOINT;
    if (process.env.AWS_S3_FORCE_PATH_STYLE === "true")
      cfg.forcePathStyle = true;
    if (!cfg.bucketName || !cfg.accessKeyId || !cfg.secretAccessKey) {
      throw new Error(
        "AWS S3 configuration is incomplete. Please check environment variables."
      );
    }
    s3Singleton = new S3Service(cfg);
  }
  return s3Singleton;
}
