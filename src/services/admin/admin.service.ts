import User, { IUser } from "../../models/User";
import UserAvatarVideos, { IUserAvatarVideos } from "../../models/UserAvatarVideos";
import { UserAvatarVideosService } from "../user/userAvatarVideos.service";
import DefaultAvatar, { IDefaultAvatar } from "../../models/avatar";
import { S3Service } from "../s3.service";
import { S3Config } from "../../types";

export interface GetAllUsersOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export interface GetAllUsersResult {
  users: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: "user" | "admin";
    isEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserAvatarVideoWithDownloadUrls {
  id: string;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  consentVideoS3Key?: string;
  consentVideoDownloadUrl?: string | null;
  trainingVideoS3Key?: string;
  trainingVideoDownloadUrl?: string | null;
  isAvatarCreated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDefaultAvatarData {
  avatarId: string;
  avatarName: string;
  previewImageUrl: string;
  previewVideo: Express.Multer.File;
  userAvatarVideosId?: string;
}

export class AdminService {
  private userAvatarVideosService: UserAvatarVideosService;
  private s3Service: S3Service;

  constructor() {
    this.userAvatarVideosService = new UserAvatarVideosService();
    
    // Initialize S3Service for default avatars (using main S3 bucket)
    const s3Config: S3Config = {
      region: process.env.AWS_REGION || "us-east-1",
      bucketName: process.env.AWS_S3_BUCKET || "",
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
   * Get all users with pagination and search
   */
  async getAllUsers(options: GetAllUsersOptions = {}): Promise<GetAllUsersResult> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const search = options.search?.trim() || "";
    const skip = (page - 1) * limit;

    // Build search query
    const searchQuery: any = {};
    if (search) {
      searchQuery.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count
    const total = await User.countDocuments(searchQuery);

    // Get users (exclude password field)
    const users = await User.find(searchQuery)
      .select("-password -emailVerificationToken -resetPasswordToken -lastUsedResetToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedUsers = users.map((user) => ({
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    return {
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all user avatar videos across all users with download URLs
   */
  async getAllUserAvatarVideos(): Promise<UserAvatarVideoWithDownloadUrls[]> {
    // Get all avatar videos
    const avatarVideos = await UserAvatarVideos.find()
      .sort({ createdAt: -1 })
      .lean();

    // Get unique user IDs
    const userIds = [...new Set(avatarVideos.map((v) => v.userId.toString()))];

    // Fetch all users in one query
    const users = await User.find({ _id: { $in: userIds } })
      .select("firstName lastName email")
      .lean();

    // Create a map for quick user lookup
    const userMap = new Map(
      users.map((u) => [u._id.toString(), u])
    );

    // Convert to format with download URLs
    const result: UserAvatarVideoWithDownloadUrls[] = [];

    for (const video of avatarVideos) {
      const userId = video.userId.toString();
      const user = userMap.get(userId);

      // Generate download URLs for both videos
      const consentVideoDownloadUrl = video.consentVideoS3Key
        ? await this.userAvatarVideosService.generateAdminDownloadUrl(
            video.consentVideoS3Key
          )
        : null;

      const trainingVideoDownloadUrl = video.trainingVideoS3Key
        ? await this.userAvatarVideosService.generateAdminDownloadUrl(
            video.trainingVideoS3Key
          )
        : null;

      result.push({
        id: video._id.toString(),
        userId: userId,
        user: {
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          email: user?.email || "",
        },
        consentVideoS3Key: video.consentVideoS3Key,
        consentVideoDownloadUrl,
        trainingVideoS3Key: video.trainingVideoS3Key,
        trainingVideoDownloadUrl,
        isAvatarCreated: video.isAvatarCreated,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
      });
    }

    return result;
  }

  /**
   * Get user avatar videos for a specific user with download URLs
   */
  async getUserAvatarVideosByUserId(
    userId: string
  ): Promise<UserAvatarVideoWithDownloadUrls[]> {
    // Verify user exists
    const user = await User.findById(userId).select("firstName lastName email");
    if (!user) {
      throw new Error("User not found");
    }

    // Get avatar videos for this user
    const avatarVideos = await UserAvatarVideos.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Convert to format with download URLs
    const result: UserAvatarVideoWithDownloadUrls[] = [];

    for (const video of avatarVideos) {
      // Generate download URLs for both videos
      const consentVideoDownloadUrl = video.consentVideoS3Key
        ? await this.userAvatarVideosService.generateAdminDownloadUrl(
            video.consentVideoS3Key
          )
        : null;

      const trainingVideoDownloadUrl = video.trainingVideoS3Key
        ? await this.userAvatarVideosService.generateAdminDownloadUrl(
            video.trainingVideoS3Key
          )
        : null;

      result.push({
        id: video._id.toString(),
        userId: userId,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
        consentVideoS3Key: video.consentVideoS3Key,
        consentVideoDownloadUrl,
        trainingVideoS3Key: video.trainingVideoS3Key,
        trainingVideoDownloadUrl,
        isAvatarCreated: video.isAvatarCreated,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
      });
    }

    return result;
  }

  /**
   * Generate S3 key for default avatar preview video
   */
  private generatePreviewVideoS3Key(avatarId: string, filename: string): string {
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return `default-avatars/${avatarId}/preview_${timestamp}_${safeFilename}`;
  }

  /**
   * Create default avatar with video upload
   */
  async createDefaultAvatar(data: CreateDefaultAvatarData): Promise<IDefaultAvatar> {
    // Check if avatar_id already exists
    const existingAvatar = await DefaultAvatar.findOne({ avatar_id: data.avatarId });
    if (existingAvatar) {
      throw new Error(`Avatar with ID '${data.avatarId}' already exists`);
    }

    let userId: string | undefined;

    // Validate and update UserAvatarVideos if provided
    if (data.userAvatarVideosId) {
      const userAvatarVideos = await UserAvatarVideos.findById(data.userAvatarVideosId);
      if (!userAvatarVideos) {
        throw new Error("UserAvatarVideos not found");
      }

      // Update isAvatarCreated to true
      userAvatarVideos.isAvatarCreated = true;
      await userAvatarVideos.save();

      // Use the userId from UserAvatarVideos
      userId = userAvatarVideos.userId.toString();
    }

    // Generate S3 key for preview video
    const previewVideoS3Key = this.generatePreviewVideoS3Key(
      data.avatarId,
      data.previewVideo.originalname || "preview.mp4"
    );

    // Upload preview video to S3
    await this.s3Service.uploadVideoFromPath(
      previewVideoS3Key,
      data.previewVideo.path,
      data.previewVideo.mimetype,
      {
        avatarId: data.avatarId,
        fileType: "preview",
        uploadedAt: new Date().toISOString(),
        originalName: data.previewVideo.originalname || "preview.mp4",
      }
    );

    // Create DefaultAvatar document
    const defaultAvatar = new DefaultAvatar({
      avatar_id: data.avatarId,
      avatar_name: data.avatarName,
      preview_image_url: data.previewImageUrl,
      preview_video_url: previewVideoS3Key,
      default: true,
      avatarType: "video_avatar",
      status: "training",
      userId: userId ? userId : undefined,
    });

    await defaultAvatar.save();

    return defaultAvatar;
  }
}

