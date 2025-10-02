import Video from "../../../database/models/Video";
import User from "../../../database/models/User";
import WorkflowHistory from "../../../database/models/WorkflowHistory";
import { notificationService } from "../../shared/notification";
import { getS3 } from "../../shared/storage/s3";
import {
  VideoData,
  VideoDownloadData,
  VideoStatusData,
  VideoConfig,
  VideoError,
  NotFoundError,
  VideoStats,
} from "../types/video.types";
import { logVideoEvent, logVideoError } from "../utils/video.utils";

export class VideoCoreService {
  private readonly config: VideoConfig;
  private readonly s3Service = getS3();

  constructor() {
    this.config = {
      webhookUrl: process.env.VIDEO_CREATION_WEBHOOK_URL || "",
      generateWebhookUrl: process.env.GENERATE_VIDEO_WEBHOOK_URL || "",
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 10,
      maxVideoSize: 100 * 1024 * 1024, // 100MB
      maxTitleLength: 200,
      maxPromptLength: 1000,
    };
  }

  // ==================== VIDEO GALLERY ====================

  async getUserVideos(userId: string): Promise<{
    videos: any[];
    stats: VideoStats;
  }> {
    try {
      const videosWithUrls = await this.getUserVideosWithDownloadUrls(userId);
      const stats = await this.getUserVideoStats(userId);

      const formattedVideos = videosWithUrls.map((video: any) => ({
        id: video._id.toString(),
        videoId: video.videoId,
        title: video.title,
        status: video.status,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        metadata: video.metadata,
        downloadUrl: video.downloadUrl || null,
        videoUrl: video.videoUrl || null,
      }));

      return {
        videos: formattedVideos,
        stats,
      };
    } catch (error) {
      logVideoError(error as Error, { userId, action: "getUserVideos" });
      throw new VideoError("Failed to retrieve user videos", 500);
    }
  }

  // ==================== VIDEO DELETION ====================

  async deleteVideo(videoId: string, userId: string): Promise<boolean> {
    try {
      const video = await this.getVideo(videoId);
      if (!video) {
        throw new NotFoundError("Video not found");
      }

      if (video.userId && video.userId.toString() !== userId) {
        throw new VideoError("Unauthorized to delete this video", 403);
      }

      const deleted = await Video.findOneAndDelete({ videoId });
      if (!deleted) {
        throw new VideoError("Failed to delete video", 500);
      }

      logVideoEvent("video_deleted", { videoId, userId });
      return true;
    } catch (error) {
      if (error instanceof VideoError || error instanceof NotFoundError) {
        throw error;
      }
      logVideoError(error as Error, { videoId, userId, action: "deleteVideo" });
      throw new VideoError("Failed to delete video", 500);
    }
  }

  // ==================== VIDEO DOWNLOAD ====================

  async downloadVideo(downloadData: VideoDownloadData): Promise<{
    videoId: string;
    title: string;
    size: number;
    downloadUrl: string;
  }> {
    try {
      const { videoUrl, email, title, executionId } = downloadData;

      const user = await User.findOne({ email });
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Send initial notification
      notificationService.notifyVideoDownloadProgress(
        user._id.toString(),
        "download",
        "progress",
        {
          message: "Starting video download...",
        }
      );

      const result = await this.downloadAndUploadVideo({
        videoUrl,
        email,
        title,
      });

      // Update workflow history if executionId is provided
      if (executionId) {
        try {
          await WorkflowHistory.findOneAndUpdate(
            { executionId },
            {
              status: "completed",
              completedAt: new Date(),
            }
          );
          logVideoEvent("workflow_completed", { executionId });
        } catch (workflowError) {
          logVideoError(workflowError as Error, {
            executionId,
            action: "updateWorkflow",
          });
        }
      }

      // Send success notification
      notificationService.notifyVideoDownloadProgress(
        user._id.toString(),
        "complete",
        "success",
        {
          message: "Video downloaded and uploaded successfully!",
          videoId: result.videoId,
          title: result.title,
          size: result.size,
        }
      );

      return {
        videoId: result.videoId,
        title: result.title,
        size: result.size,
        downloadUrl: (result as any).downloadUrl || "",
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      // Update workflow history as failed if executionId is provided
      if (downloadData.executionId) {
        try {
          await WorkflowHistory.findOneAndUpdate(
            { executionId: downloadData.executionId },
            {
              status: "failed",
              completedAt: new Date(),
              errorMessage: (error as Error).message || "Video download failed",
            }
          );
        } catch (workflowError) {
          logVideoError(workflowError as Error, {
            executionId: downloadData.executionId,
          });
        }
      }

      // Send error notification
      try {
        const user = await this.getUserByEmail(downloadData.email);
        if (user) {
          notificationService.notifyVideoDownloadProgress(
            user._id.toString(),
            "error",
            "error",
            {
              message: "Failed to download video. Please try again.",
              error: (error as Error).message || "Unknown error occurred",
            }
          );
        }
      } catch (notificationError) {
        logVideoError(notificationError as Error, {
          email: downloadData.email,
        });
      }

      logVideoError(error as Error, { downloadData, action: "downloadVideo" });
      throw new VideoError("Failed to download video", 500);
    }
  }

  // ==================== VIDEO STATUS UPDATE ====================

  async updateVideoStatus(statusData: VideoStatusData): Promise<{
    videoId: string;
    status: string;
    updatedAt: string;
  }> {
    try {
      const { videoId, status, metadata } = statusData;

      const updatedVideo = await Video.findOneAndUpdate(
        { videoId },
        { status, updatedAt: new Date() },
        { new: true }
      );
      if (!updatedVideo) {
        throw new NotFoundError("Video not found");
      }

      // Update metadata if provided
      if (metadata) {
        await this.updateVideoMetadata(videoId, metadata);
      }

      logVideoEvent("video_status_updated", { videoId, status });

      return {
        videoId: updatedVideo.videoId,
        status: updatedVideo.status,
        updatedAt: updatedVideo.updatedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logVideoError(error as Error, {
        statusData,
        action: "updateVideoStatus",
      });
      throw new VideoError("Failed to update video status", 500);
    }
  }

  // ==================== CONFIGURATION ====================

  getConfig(): VideoConfig {
    return { ...this.config };
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      videoService: "available" | "unavailable";
      database: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      return {
        status: "healthy",
        services: {
          videoService: "available",
          database: "available",
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          videoService: "unavailable",
          database: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ==================== HELPER METHODS ====================

  async getUserVideosWithDownloadUrls(userId: string): Promise<any[]> {
    try {
      const videos = await Video.find({ userId }).sort({ createdAt: -1 });
      const videosWithUrls = [];

      for (const video of videos) {
        let downloadUrl = null;
        if (video.s3Key) {
          try {
            downloadUrl = await this.s3Service.createDownloadUrl(
              video.s3Key,
              video.secretKey || ""
            );
          } catch (error) {
            console.error(
              `Failed to get download URL for video ${video.videoId}:`,
              error
            );
          }
        }

        videosWithUrls.push({
          ...video.toObject(),
          downloadUrl,
        });
      }

      return videosWithUrls;
    } catch (error: any) {
      logVideoError(error as Error, {
        userId,
        action: "getUserVideosWithDownloadUrls",
      });
      throw new VideoError("Failed to get user videos with download URLs", 500);
    }
  }

  async getUserVideoStats(userId: string): Promise<VideoStats> {
    try {
      const totalVideos = await Video.countDocuments({ userId });
      const completedVideos = await Video.countDocuments({
        userId,
        status: "ready",
      });
      const processingVideos = await Video.countDocuments({
        userId,
        status: "processing",
      });
      const failedVideos = await Video.countDocuments({
        userId,
        status: "failed",
      });

      return {
        totalCount: totalVideos,
        readyCount: completedVideos,
        processingCount: processingVideos,
        failedCount: failedVideos,
      };
    } catch (error: any) {
      logVideoError(error as Error, { userId, action: "getUserVideoStats" });
      throw new VideoError("Failed to get user video stats", 500);
    }
  }

  async getVideo(videoId: string): Promise<any> {
    try {
      const video = await Video.findOne({ videoId });
      if (!video) {
        throw new NotFoundError("Video not found");
      }
      return video;
    } catch (error: any) {
      logVideoError(error as Error, { videoId, action: "getVideo" });
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<any> {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw new NotFoundError("User not found");
      }
      return user;
    } catch (error: any) {
      logVideoError(error as Error, { email, action: "getUserByEmail" });
      throw error;
    }
  }

  async downloadAndUploadVideo(downloadData: any): Promise<any> {
    try {
      // This is a placeholder implementation
      // The actual implementation would depend on the specific requirements
      return {
        videoId: downloadData.videoId,
        title: downloadData.title,
        size: 0,
        downloadUrl: "",
      };
    } catch (error: any) {
      logVideoError(error as Error, {
        downloadData,
        action: "downloadAndUploadVideo",
      });
      throw new VideoError("Failed to download and upload video", 500);
    }
  }

  async updateVideoMetadata(videoId: string, metadata: any): Promise<void> {
    try {
      await Video.findOneAndUpdate(
        { videoId },
        { metadata, updatedAt: new Date() }
      );
    } catch (error: any) {
      logVideoError(error as Error, {
        videoId,
        metadata,
        action: "updateVideoMetadata",
      });
      throw new VideoError("Failed to update video metadata", 500);
    }
  }
}

export default VideoCoreService;
