import VideoCoreService from "./video-core.service";
import VideoCreationService from "./video-creation.service";
import VideoManagementService from "./video-management.service";
import {
  VideoData,
  VideoCreationData,
  VideoGenerationData,
  VideoDownloadData,
  VideoStatusData,
  PhotoAvatarData,
  VideoConfig,
  VideoError,
  VideoStats,
} from "../types/video.types";

export class VideoModuleService {
  private readonly coreService: VideoCoreService;
  private readonly creationService: VideoCreationService;
  private readonly managementService: VideoManagementService;

  constructor() {
    this.coreService = new VideoCoreService();
    this.creationService = new VideoCreationService();
    this.managementService = new VideoManagementService();
  }

  // ==================== CORE VIDEO OPERATIONS ====================

  async getUserVideos(userId: string): Promise<{
    videos: any[];
    stats: VideoStats;
  }> {
    return this.coreService.getUserVideos(userId);
  }

  async deleteVideo(videoId: string, userId: string): Promise<boolean> {
    return this.coreService.deleteVideo(videoId, userId);
  }

  async downloadVideo(downloadData: VideoDownloadData): Promise<{
    videoId: string;
    title: string;
    size: number;
    downloadUrl: string;
  }> {
    return this.coreService.downloadVideo(downloadData);
  }

  async updateVideoStatus(statusData: VideoStatusData): Promise<{
    videoId: string;
    status: string;
    updatedAt: string;
  }> {
    return this.coreService.updateVideoStatus(statusData);
  }

  // ==================== VIDEO CREATION OPERATIONS ====================

  async createVideo(creationData: VideoCreationData): Promise<{
    requestId: string;
    webhookResponse: any;
    timestamp: string;
    status: string;
  }> {
    return this.creationService.createVideo(creationData);
  }

  async generateVideo(generationData: VideoGenerationData): Promise<{
    status: string;
    timestamp: string;
    estimated_completion: string;
    note: string;
  }> {
    return this.creationService.generateVideo(generationData);
  }

  // ==================== MANAGEMENT OPERATIONS ====================

  async getUserAvatars(userId: string): Promise<{
    success: boolean;
    custom: any[];
    default: any[];
  }> {
    return this.managementService.getUserAvatars(userId);
  }

  async getUserVoices(userId: string): Promise<{
    customVoices: any[];
    defaultVoices: any[];
  }> {
    return this.managementService.getUserVoices(userId);
  }

  async createPhotoAvatar(avatarData: PhotoAvatarData): Promise<void> {
    return this.managementService.createPhotoAvatar(avatarData);
  }

  async checkPendingWorkflows(userId: string): Promise<{
    hasPendingWorkflows: boolean;
    pendingCount: number;
    message?: string;
    workflows?: Array<{
      executionId: string;
      createdAt: string;
      email: string;
    }>;
  }> {
    return this.managementService.checkPendingWorkflows(userId);
  }

  async trackExecution(
    executionId: string,
    email: string
  ): Promise<{
    executionId: string;
    userId: string;
    email: string;
    timestamp: string;
  }> {
    return this.managementService.trackExecution(executionId, email);
  }

  async getAllTopics(): Promise<any[]> {
    return this.managementService.getAllTopics();
  }

  async getTopicByType(topic: string): Promise<any> {
    return this.managementService.getTopicByType(topic);
  }

  async getTopicById(id: string): Promise<any> {
    return this.managementService.getTopicById(id);
  }

  // ==================== CONFIGURATION ====================

  getConfig(): VideoConfig {
    return this.coreService.getConfig();
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      videoService: "available" | "unavailable";
      webhook: "available" | "unavailable";
      database: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      const [coreHealth, creationHealth, managementHealth] = await Promise.all([
        this.coreService.healthCheck(),
        this.creationService.healthCheck(),
        this.managementService.healthCheck(),
      ]);

      const isHealthy =
        coreHealth.status === "healthy" &&
        creationHealth.status === "healthy" &&
        managementHealth.status === "healthy";

      return {
        status: isHealthy ? "healthy" : "unhealthy",
        services: {
          videoService: coreHealth.services.videoService,
          webhook: creationHealth.services.webhook,
          database: managementHealth.services.database,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          videoService: "unavailable",
          webhook: "unavailable",
          database: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default VideoModuleService;
