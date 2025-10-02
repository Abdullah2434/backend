import VideoModel from "../../../models/Video";
import User from "../../../models/User";
import WorkflowHistory from "../../../models/WorkflowHistory";
import DefaultAvatar from "../../../models/avatar";
import DefaultVoice from "../../../models/voice";
import Topic from "../../../models/Topic";
import { videoStorageService } from "./storage.service";
import { notificationService } from "../../../services/notification.service";
import { logger } from "../../../core/utils/logger";
import {
  Video,
  VideoStats,
  DownloadVideoRequest,
  TopicData,
} from "../types/video.types";
import { NotFoundError } from "../../../core/errors";

export class VideoService {
  /**
   * Get user videos with download URLs
   */
  async getUserVideosWithDownloadUrls(userId: string): Promise<Video[]> {
    const videos = await VideoModel.find({ userId }).sort({ createdAt: -1 });

    return Promise.all(
      videos.map(async (video) => {
        let downloadUrl = null;
        let videoUrl = null;

        if (video.status === "ready" && video.s3Key) {
          try {
            downloadUrl = await videoStorageService.getDownloadUrl(video.s3Key);
            videoUrl = downloadUrl;
          } catch (error) {
            logger.error("Error getting download URL", error);
          }
        }

        return {
          ...video.toObject(),
          downloadUrl,
          videoUrl,
        };
      })
    );
  }

  /**
   * Get video statistics for a user
   */
  async getUserVideoStats(userId: string): Promise<VideoStats> {
    const totalCount = await VideoModel.countDocuments({ userId });
    const readyCount = await VideoModel.countDocuments({
      userId,
      status: "ready",
    });
    const processingCount = await VideoModel.countDocuments({
      userId,
      status: "processing",
    });
    const failedCount = await VideoModel.countDocuments({
      userId,
      status: "failed",
    });

    return {
      totalCount,
      readyCount,
      processingCount,
      failedCount,
    };
  }

  /**
   * Get a single video by ID
   */
  async getVideo(videoId: string): Promise<any> {
    return await VideoModel.findOne({ videoId });
  }

  /**
   * Update video status
   */
  async updateVideoStatus(
    videoId: string,
    status: "processing" | "ready" | "failed"
  ): Promise<any> {
    return await VideoModel.findOneAndUpdate(
      { videoId },
      { status, updatedAt: new Date() },
      { new: true }
    );
  }

  /**
   * Update video metadata
   */
  async updateVideoMetadata(videoId: string, metadata: any): Promise<any> {
    return await VideoModel.findOneAndUpdate(
      { videoId },
      { metadata, updatedAt: new Date() },
      { new: true }
    );
  }

  /**
   * Delete a video
   */
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      const video = await VideoModel.findOne({ videoId });

      if (!video) {
        return false;
      }

      // Delete from S3 if exists
      if (video.s3Key) {
        try {
          await videoStorageService.deleteVideo(video.s3Key);
        } catch (error) {
          logger.error("Error deleting video from S3", error);
        }
      }

      // Delete from database
      await VideoModel.deleteOne({ videoId });
      return true;
    } catch (error) {
      logger.error("Error deleting video", error);
      return false;
    }
  }

  /**
   * Download and upload video
   */
  async downloadAndUploadVideo(request: DownloadVideoRequest): Promise<any> {
    const { videoUrl, email, title, executionId } = request;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Download video
    logger.info("Downloading video from URL", { videoUrl });
    const videoBuffer = await videoStorageService.downloadFromUrl(videoUrl);

    // Generate S3 key
    const timestamp = Date.now();
    const s3Key = `videos/${user._id}/${timestamp}.mp4`;

    // Upload to S3
    logger.info("Uploading video to S3", { s3Key });
    await videoStorageService.uploadVideo(videoBuffer, s3Key, "video/mp4");

    // Create video record
    const video = new VideoModel({
      videoId: `${user._id}_${timestamp}`,
      userId: user._id,
      title,
      status: "ready",
      s3Key,
      metadata: {
        size: videoBuffer.length,
        originalUrl: videoUrl,
      },
    });

    await video.save();

    return {
      videoId: video.videoId,
      title: video.title,
      size: videoBuffer.length,
      status: "ready",
    };
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<any> {
    return await User.findOne({ email });
  }

  /**
   * Check pending workflows for user
   */
  async checkPendingWorkflows(userId: string): Promise<any> {
    const pendingWorkflows = await WorkflowHistory.find({
      userId,
      status: "pending",
    });

    return {
      hasPendingWorkflows: pendingWorkflows.length > 0,
      pendingCount: pendingWorkflows.length,
      workflows: pendingWorkflows.map((w) => ({
        executionId: w.executionId,
        createdAt: w.createdAt,
        email: w.email,
      })),
    };
  }

  /**
   * Get all available avatars (public + user's custom)
   */
  async getAvatars(userId?: string): Promise<any> {
    let customAvatars: any[] = [];

    if (userId) {
      customAvatars = await DefaultAvatar.find({ userId });
    }

    const defaultAvatars = await DefaultAvatar.find({
      userId: { $exists: false },
      default: true,
    });

    return {
      custom: customAvatars,
      default: defaultAvatars,
    };
  }

  /**
   * Get all available voices (public + user's custom)
   */
  async getVoices(userId?: string): Promise<any> {
    let customVoices: any[] = [];

    if (userId) {
      customVoices = await DefaultVoice.find({ userId });
    }

    const defaultVoices = await DefaultVoice.find({
      userId: { $exists: false },
      default: true,
    });

    return {
      custom: customVoices,
      default: defaultVoices,
    };
  }

  /**
   * Get all topics
   */
  async getAllTopics(): Promise<TopicData[]> {
    return await Topic.find();
  }

  /**
   * Get topic by type
   */
  async getTopicByType(topic: string): Promise<TopicData | null> {
    return await Topic.findOne({ topic });
  }

  /**
   * Get topic by ID
   */
  async getTopicById(id: string): Promise<TopicData | null> {
    return await Topic.findById(id);
  }
}

export const videoService = new VideoService();
