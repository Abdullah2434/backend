import { S3Service } from "../s3.service";
import UserAvatarVideos, { IUserAvatarVideos } from "../../models/UserAvatarVideos";
import { S3Config } from "../../types";

export class UserAvatarVideosService {
  private s3Service: S3Service;

  constructor() {
    // Create S3Service instance with custom bucket for avatar videos
    const s3Config: S3Config = {
      region: process.env.AWS_REGION || "us-east-1",
      bucketName: "avatar-videos-training-consent",
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
        "AWS S3 configuration is incomplete. Please check environment variables."
      );
    }

    this.s3Service = new S3Service(s3Config);
  }

  /**
   * Generate S3 key for avatar video file
   */
  private generateS3Key(userId: string, fileType: "consent" | "training", filename: string): string {
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `${userId}/${timestamp}_${fileType}_${safeFilename}`;
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
    const consentVideoS3Key = files.consentVideo
      ? this.generateS3Key(userId, "consent", files.consentVideo.originalname || "consent.mp4")
      : undefined;

    const trainingVideoS3Key = files.trainingVideo
      ? this.generateS3Key(userId, "training", files.trainingVideo.originalname || "training.mp4")
      : undefined;

    // Upload consent video to S3 if provided
    if (files.consentVideo && consentVideoS3Key) {
      await this.s3Service.uploadVideoFromPath(
        consentVideoS3Key,
        files.consentVideo.path,
        files.consentVideo.mimetype,
        {
          userId,
          fileType: "consent",
          uploadedAt: new Date().toISOString(),
          originalName: files.consentVideo.originalname || "consent.mp4",
        }
      );
    }

    // Upload training video to S3 if provided
    if (files.trainingVideo && trainingVideoS3Key) {
      await this.s3Service.uploadVideoFromPath(
        trainingVideoS3Key,
        files.trainingVideo.path,
        files.trainingVideo.mimetype,
        {
          userId,
          fileType: "training",
          uploadedAt: new Date().toISOString(),
          originalName: files.trainingVideo.originalname || "training.mp4",
        }
      );
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
}

