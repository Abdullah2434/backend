import { S3Service } from "../s3.service";
import UserAvatarVideos, { IUserAvatarVideos } from "../../models/UserAvatarVideos";
import { S3Config } from "../../types";

export class UserAvatarVideosService {
  private s3Service: S3Service;
  private readonly AVATAR_VIDEOS_BUCKET = "avatar-videos-training-consent";

  constructor() {
    // Create S3Service instance for avatar videos bucket
    const s3Config: S3Config = {
      region: process.env.AWS_REGION || "us-east-1",
      bucketName: this.AVATAR_VIDEOS_BUCKET,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    };

    if (process.env.AWS_S3_ENDPOINT) {
      s3Config.endpoint = process.env.AWS_S3_ENDPOINT;
    }

    if (process.env.AWS_S3_FORCE_PATH_STYLE === "true") {
      s3Config.forcePathStyle = true;
    }

    if (!s3Config.bucketName || !s3Config.accessKeyId || !s3Config.secretAccessKey) {
      throw new Error(
        "AWS S3 configuration is incomplete. Please check environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION"
      );
    }

    this.s3Service = new S3Service(s3Config);
  }

  /**
   * Generate S3 key for avatar video file
   * Format: avatar-videos/{userId}/{timestamp}_{type}_{safeFilename}
   */
  private generateAvatarVideoS3Key(
    userId: string,
    fileType: "consent" | "training",
    filename: string
  ): string {
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `avatar-videos/${userId}/${timestamp}_${fileType}_${safeFilename}`;
  }

  /**
   * Upload avatar videos to S3 and save/update record in database
   */
  async uploadAvatarVideos(
    userId: string,
    files: {
      consentVideo?: Express.Multer.File;
      trainingVideo?: Express.Multer.File;
    },
    isAvatarCreated: boolean = false
  ): Promise<IUserAvatarVideos> {
    let consentVideoS3Key: string | undefined;
    let trainingVideoS3Key: string | undefined;

    // Upload consent video to S3 if provided
    if (files.consentVideo) {
      const s3Key = this.generateAvatarVideoS3Key(
        userId,
        "consent",
        files.consentVideo.originalname || "consent.mp4"
      );
      
      await this.s3Service.uploadVideoFromPath(
        s3Key,
        files.consentVideo.path,
        files.consentVideo.mimetype,
        {
          userId,
          fileType: "consent",
          uploadedAt: new Date().toISOString(),
          originalName: files.consentVideo.originalname || "consent.mp4",
        }
      );
      
      consentVideoS3Key = s3Key;
    }

    // Upload training video to S3 if provided
    if (files.trainingVideo) {
      const s3Key = this.generateAvatarVideoS3Key(
        userId,
        "training",
        files.trainingVideo.originalname || "training.mp4"
      );
      
      await this.s3Service.uploadVideoFromPath(
        s3Key,
        files.trainingVideo.path,
        files.trainingVideo.mimetype,
        {
          userId,
          fileType: "training",
          uploadedAt: new Date().toISOString(),
          originalName: files.trainingVideo.originalname || "training.mp4",
        }
      );
      
      trainingVideoS3Key = s3Key;
    }

    // Create new record in database (allow multiple records per user)
    const record = new UserAvatarVideos({
      userId,
      consentVideoS3Key,
      trainingVideoS3Key,
      isAvatarCreated,
    });

    await record.save();

    return record;
  }

  /**
   * Get all user avatar videos records
   */
  async getUserAvatarVideos(userId: string): Promise<IUserAvatarVideos[]> {
    return await UserAvatarVideos.find({ userId }).sort({ createdAt: -1 });
  }

  /**
   * Get specific avatar videos record by ID
   */
  async getUserAvatarVideoById(
    userId: string,
    recordId: string
  ): Promise<IUserAvatarVideos | null> {
    return await UserAvatarVideos.findOne({ _id: recordId, userId });
  }

  /**
   * Generate signed URL for admin download access
   */
  async generateAdminDownloadUrl(s3Key: string): Promise<string | null> {
    if (!s3Key) {
      return null;
    }

    try {
      const signedUrl = await this.s3Service.getSignedVideoUrl(s3Key, 3600); // 1 hour expiry
      return signedUrl;
    } catch (error) {
      console.error("Error generating admin download URL:", error);
      return null;
    }
  }

  /**
   * Generate signed preview URL for admin access
   */
  async generateAdminPreviewUrl(s3Key: string): Promise<string | null> {
    if (!s3Key) {
      return null;
    }

    try {
      const signedUrl = await this.s3Service.getSignedVideoUrl(s3Key, 3600); // 1 hour expiry
      return signedUrl;
    } catch (error) {
      console.error("Error generating admin preview URL:", error);
      return null;
    }
  }
}

