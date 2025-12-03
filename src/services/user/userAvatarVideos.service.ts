import { GoogleDriveService } from "../googleDrive.service";
import UserAvatarVideos, { IUserAvatarVideos } from "../../models/UserAvatarVideos";

export class UserAvatarVideosService {
  private googleDriveService: GoogleDriveService;

  constructor() {
    // Create GoogleDriveService instance with credentials from environment variables
    const driveConfig = {
      clientEmail: process.env.GOOGLE_DRIVE_CLIENT_EMAIL || "",
      privateKey: process.env.GOOGLE_DRIVE_PRIVATE_KEY || "",
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
    };

    if (!driveConfig.clientEmail || !driveConfig.privateKey || !driveConfig.folderId) {
      throw new Error(
        "Google Drive configuration is incomplete. Please check environment variables: GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID"
      );
    }

    this.googleDriveService = new GoogleDriveService(driveConfig);
  }

  /**
   * Generate file name for avatar video file
   */
  private generateFileName(userId: string, fileType: "consent" | "training", filename: string): string {
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `${userId}_${timestamp}_${fileType}_${safeFilename}`;
  }

  /**
   * Upload avatar videos to Google Drive and save/update record in database
   */
  async uploadAvatarVideos(
    userId: string,
    files: {
      consentVideo?: Express.Multer.File;
      trainingVideo?: Express.Multer.File;
    },
    isAvatarCreated: boolean = false
  ): Promise<IUserAvatarVideos> {
    let consentVideoDriveId: string | undefined;
    let trainingVideoDriveId: string | undefined;

    // Upload consent video to Google Drive if provided
    if (files.consentVideo) {
      const fileName = this.generateFileName(
        userId,
        "consent",
        files.consentVideo.originalname || "consent.mp4"
      );
      consentVideoDriveId = await this.googleDriveService.uploadFileFromPath(
        files.consentVideo.path,
        fileName,
        files.consentVideo.mimetype,
        {
          userId,
          fileType: "consent",
          uploadedAt: new Date().toISOString(),
          originalName: files.consentVideo.originalname || "consent.mp4",
        }
      );
    }

    // Upload training video to Google Drive if provided
    if (files.trainingVideo) {
      const fileName = this.generateFileName(
        userId,
        "training",
        files.trainingVideo.originalname || "training.mp4"
      );
      trainingVideoDriveId = await this.googleDriveService.uploadFileFromPath(
        files.trainingVideo.path,
        fileName,
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
      consentVideoDriveId,
      trainingVideoDriveId,
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
   * Generate shareable link for admin access
   */
  async generateAdminDownloadUrl(driveId: string): Promise<string | null> {
    if (!driveId) {
      return null;
    }

    try {
      const shareableLink = await this.googleDriveService.generateShareableLink(driveId);
      return shareableLink;
    } catch (error) {
      console.error("Error generating admin download URL:", error);
      return null;
    }
  }

  /**
   * Generate preview link for admin access
   */
  async generateAdminPreviewUrl(driveId: string): Promise<string | null> {
    if (!driveId) {
      return null;
    }

    try {
      const previewLink = await this.googleDriveService.getPreviewLink(driveId);
      return previewLink;
    } catch (error) {
      console.error("Error generating admin preview URL:", error);
      return null;
    }
  }
}

