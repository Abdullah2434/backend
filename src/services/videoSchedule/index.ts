import { IVideoSchedule, ScheduleData } from "./types";
import { VideoScheduleCreation } from "./schedule-creation.service";
import { VideoScheduleManagement } from "./schedule-management.service";
import { VideoSchedulePostManagement } from "./post-management.service";
import { VideoScheduleProcessing } from "./video-processing.service";

export class VideoScheduleService {
  private creationService = new VideoScheduleCreation();
  private managementService = new VideoScheduleManagement();
  private postService = new VideoSchedulePostManagement();
  private processingService = new VideoScheduleProcessing();

  /**
   * Create a new video schedule asynchronously (returns immediately with processing status)
   */
  async createScheduleAsync(
    userId: string,
    email: string,
    scheduleData: ScheduleData
  ): Promise<IVideoSchedule> {
    return this.creationService.createScheduleAsync(userId, email, scheduleData);
  }

  /**
   * Create a new video schedule (automatically set to one month duration)
   */
  async createSchedule(
    userId: string,
    email: string,
    scheduleData: ScheduleData
  ): Promise<IVideoSchedule> {
    return this.creationService.createSchedule(userId, email, scheduleData);
  }

  /**
   * Get user's active schedule
   */
  async getUserSchedule(userId: string): Promise<IVideoSchedule | null> {
    return this.managementService.getUserSchedule(userId);
  }

  /**
   * Update schedule
   */
  async updateSchedule(
    scheduleId: string,
    userId: string,
    updateData: Partial<ScheduleData>
  ): Promise<IVideoSchedule | null> {
    return this.managementService.updateSchedule(
      scheduleId,
      userId,
      updateData
    );
  }

  /**
   * Deactivate schedule
   */
  async deactivateSchedule(
    scheduleId: string,
    userId: string
  ): Promise<boolean> {
    return this.managementService.deactivateSchedule(scheduleId, userId);
  }

  /**
   * Delete entire schedule
   */
  async deleteEntireSchedule(
    scheduleId: string,
    userId: string
  ): Promise<boolean> {
    return this.managementService.deleteEntireSchedule(scheduleId, userId);
  }

  /**
   * Update individual post in a schedule
   */
  async updateSchedulePost(
    scheduleId: string,
    postIndex: number,
    userId: string,
    updateData: {
      description?: string;
      keypoints?: string;
      scheduledFor?: Date;
      instagram_caption?: string;
      facebook_caption?: string;
      linkedin_caption?: string;
      twitter_caption?: string;
      tiktok_caption?: string;
      youtube_caption?: string;
    }
  ): Promise<IVideoSchedule | null> {
    return this.postService.updateSchedulePost(
      scheduleId,
      postIndex,
      userId,
      updateData
    );
  }

  /**
   * Update individual post in a schedule by post ID
   */
  async updateSchedulePostById(
    scheduleId: string,
    postId: string,
    userId: string,
    updateData: {
      description?: string;
      keypoints?: string;
      scheduledFor?: Date;
      instagram_caption?: string;
      facebook_caption?: string;
      linkedin_caption?: string;
      twitter_caption?: string;
      tiktok_caption?: string;
      youtube_caption?: string;
    }
  ): Promise<IVideoSchedule | null> {
    return this.postService.updateSchedulePostById(
      scheduleId,
      postId,
      userId,
      updateData
    );
  }

  /**
   * Delete individual post from a schedule
   */
  async deleteSchedulePost(
    scheduleId: string,
    postIndex: number,
    userId: string
  ): Promise<IVideoSchedule | null> {
    return this.postService.deleteSchedulePost(
      scheduleId,
      postIndex,
      userId
    );
  }

  /**
   * Delete individual post from a schedule by post ID
   */
  async deleteSchedulePostById(
    scheduleId: string,
    postId: string,
    userId: string
  ): Promise<IVideoSchedule | null> {
    return this.postService.deleteSchedulePostById(
      scheduleId,
      postId,
      userId
    );
  }

  /**
   * Get a single post from a schedule
   */
  async getSchedulePost(
    scheduleId: string,
    postIndex: number,
    userId: string
  ): Promise<{
    schedule: IVideoSchedule;
    post: any;
    postIndex: number;
  } | null> {
    return this.postService.getSchedulePost(scheduleId, postIndex, userId);
  }

  /**
   * Get a single post from a schedule by post ID
   */
  async getSchedulePostById(
    scheduleId: string,
    postId: string,
    userId: string
  ): Promise<{
    schedule: IVideoSchedule;
    post: any;
    postIndex: number;
  } | null> {
    return this.postService.getSchedulePostById(scheduleId, postId, userId);
  }

  /**
   * Get pending videos for processing (30 minutes early)
   */
  async getPendingVideos(): Promise<IVideoSchedule[]> {
    return this.processingService.getPendingVideos();
  }

  /**
   * Process scheduled video
   */
  async processScheduledVideo(
    scheduleId: string,
    trendIndex: number,
    userSettings: any
  ): Promise<void> {
    return this.processingService.processScheduledVideo(
      scheduleId,
      trendIndex,
      userSettings
    );
  }

  /**
   * Update video status after processing
   */
  async updateVideoStatus(
    scheduleId: string,
    trendIndex: number,
    status: "completed" | "failed",
    videoId?: string
  ): Promise<void> {
    return this.processingService.updateVideoStatus(
      scheduleId,
      trendIndex,
      status,
      videoId
    );
  }
}

// Export the service as default and also export types
export default VideoScheduleService;
export { ScheduleData, IVideoSchedule } from "./types";

