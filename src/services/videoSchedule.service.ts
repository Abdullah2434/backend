import VideoSchedule, { IVideoSchedule } from "../models/VideoSchedule";
import UserVideoSettings from "../models/UserVideoSettings";
import { generateRealEstateTrends } from "./trends.service";
import { VideoService } from "../modules/video/services/video.service";
import ScheduleEmailService, {
  ScheduleEmailData,
  VideoGeneratedEmailData,
  VideoProcessingEmailData,
} from "./scheduleEmail.service";
import CaptionGenerationService from "./captionGeneration.service";
import TimezoneService from "../utils/timezone";
import { notificationService } from "./notification.service";

export interface ScheduleData {
  frequency: "once_week" | "twice_week" | "three_week" | "daily";
  schedule: {
    days: string[];
    times: string[];
  };
  startDate: Date;
  endDate: Date;
  timezone: string;
}

export class VideoScheduleService {
  private videoService = new VideoService();
  private emailService = new ScheduleEmailService();

  /**
   * Create a new video schedule asynchronously (returns immediately with processing status)
   */
  async createScheduleAsync(
    userId: string,
    email: string,
    scheduleData: ScheduleData
  ): Promise<IVideoSchedule> {
    // Validate schedule data
    this.validateScheduleData(scheduleData);

    // Check if user already has an active schedule
    const existingSchedule = await VideoSchedule.findOne({
      userId,
      isActive: true,
    });

    if (existingSchedule) {
      throw new Error("User already has an active video schedule");
    }

    // Get user video settings
    const userSettings = await UserVideoSettings.findOne({ userId });
    if (!userSettings) {
      throw new Error(
        "User video settings not found. Please complete your profile first."
      );
    }

    // Set default duration to one month from start date
    const startDate = scheduleData.startDate; // Already converted to UTC in controller
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // Add one month

    console.log(`📅 Schedule start date (UTC): ${startDate.toISOString()}`);
    console.log(`📅 Schedule end date (UTC): ${endDate.toISOString()}`);

    // Calculate number of videos needed for one month
    const numberOfVideos = this.calculateNumberOfVideos(
      scheduleData.frequency,
      startDate,
      endDate
    );

    // Generate basic trends immediately (no dynamic captions yet)
    console.log(`🎬 Generating ${numberOfVideos} basic trends immediately...`);

    const allTrends = [];
    const chunkSize = 5;
    const totalChunks = Math.ceil(numberOfVideos / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const remainingTrends = numberOfVideos - allTrends.length;
      const currentChunkSize = Math.min(chunkSize, remainingTrends);

      console.log(
        `📦 Generating chunk ${
          i + 1
        }/${totalChunks} (${currentChunkSize} trends)...`
      );

      try {
        const chunkTrends = await generateRealEstateTrends(
          currentChunkSize,
          0,
          i
        );

        if (!chunkTrends || chunkTrends.length === 0) {
          throw new Error(`Failed to generate trends for chunk ${i + 1}`);
        }

        // Use basic captions for all videos initially
        const basicTrends = chunkTrends.map((trend) => ({
          ...trend,
          instagram_caption: `${trend.description} - ${trend.keypoints}`,
          facebook_caption: `${trend.description} - ${trend.keypoints}`,
          linkedin_caption: `${trend.description} - ${trend.keypoints}`,
          twitter_caption: `${trend.description} - ${trend.keypoints}`,
          tiktok_caption: `${trend.description} - ${trend.keypoints}`,
          youtube_caption: `${trend.description} - ${trend.keypoints}`,
          enhanced_with_dynamic_posts: false,
          caption_status: "pending", // Mark for background processing
        }));

        allTrends.push(...basicTrends);
        console.log(
          `✅ Chunk ${i + 1} completed: ${basicTrends.length} trends`
        );

        // Add a small delay between chunks to avoid rate limiting
        if (i < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Error in chunk ${i + 1}:`, error);
        throw new Error(
          `Failed to generate trends in chunk ${i + 1}. Please try again.`
        );
      }
    }

    console.log(
      `✅ Generated ${allTrends.length} basic trends from OpenAI in ${totalChunks} chunks`
    );

    // Create scheduled trends
    const generatedTrends = this.createScheduledTrends(
      allTrends,
      scheduleData,
      startDate,
      endDate
    );

    // Create the schedule with processing status
    const schedule = new VideoSchedule({
      userId,
      email,
      timezone: scheduleData.timezone,
      frequency: scheduleData.frequency,
      schedule: scheduleData.schedule,
      isActive: true,
      status: "processing", // Set initial status to processing
      startDate: startDate,
      endDate: endDate,
      generatedTrends,
    });

    await schedule.save();

    // Send initial processing notification
    const { notificationService } = await import("./notification.service");
    notificationService.notifyScheduleStatus(userId, "processing", {
      scheduleId: schedule._id.toString(),
      message: "Schedule creation started",
      totalVideos: numberOfVideos,
      processedVideos: 0,
    });

    // Queue background job to generate dynamic captions for ALL videos
    this.queueBackgroundCaptionGenerationAsync(
      schedule._id.toString(),
      userId,
      userSettings,
      numberOfVideos
    );

    console.log(
      `✅ Video schedule created for user ${userId}: ${numberOfVideos} videos scheduled (processing)`
    );

    return schedule;
  }

  /**
   * Create a new video schedule (automatically set to one month duration)
   */
  async createSchedule(
    userId: string,
    email: string,
    scheduleData: ScheduleData
  ): Promise<IVideoSchedule> {
    // Validate schedule data
    this.validateScheduleData(scheduleData);

    // Check if user already has an active schedule
    const existingSchedule = await VideoSchedule.findOne({
      userId,
      isActive: true,
    });

    if (existingSchedule) {
      throw new Error("User already has an active video schedule");
    }

    // Get user video settings
    const userSettings = await UserVideoSettings.findOne({ userId });
    if (!userSettings) {
      throw new Error(
        "User video settings not found. Please complete your profile first."
      );
    }

    // Set default duration to one month from start date
    const startDate = scheduleData.startDate; // Already converted to UTC in controller
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // Add one month

    console.log(`📅 Schedule start date (UTC): ${startDate.toISOString()}`);
    console.log(`📅 Schedule end date (UTC): ${endDate.toISOString()}`);

    // Calculate number of videos needed for one month
    const numberOfVideos = this.calculateNumberOfVideos(
      scheduleData.frequency,
      startDate,
      endDate
    );

    // Generate trends for the schedule - ensure we have enough for the full month
    // Generate trends in chunks of 5 to avoid API limits
    console.log(
      `🎬 Generating ${numberOfVideos} unique trends in chunks of 5...`
    );

    const allTrends = [];
    const chunkSize = 5;
    const totalChunks = Math.ceil(numberOfVideos / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const remainingTrends = numberOfVideos - allTrends.length;
      const currentChunkSize = Math.min(chunkSize, remainingTrends);

      console.log(
        `📦 Generating chunk ${
          i + 1
        }/${totalChunks} (${currentChunkSize} trends)...`
      );

      try {
        const chunkTrends = await generateRealEstateTrends(
          currentChunkSize,
          0,
          i
        );

        if (!chunkTrends || chunkTrends.length === 0) {
          throw new Error(`Failed to generate trends for chunk ${i + 1}`);
        }

        // Accept partial results if we got at least some trends
        if (chunkTrends.length < currentChunkSize) {
          console.warn(
            `⚠️ Chunk ${i + 1}: Requested ${currentChunkSize} trends but got ${
              chunkTrends.length
            } trends`
          );
        }

        // Hybrid approach: Generate dynamic captions for first video only
        // Remaining videos will be processed in background
        let enhancedTrends;
        if (i === 0) {
          // First chunk: Generate dynamic captions immediately
          console.log(
            `🎯 Generating dynamic captions for first video (chunk ${i + 1})...`
          );
          enhancedTrends = await this.generateDynamicCaptionsForTrends(
            chunkTrends,
            userSettings,
            userId
          );
          console.log(
            `✅ First video captions generated: ${enhancedTrends.length} trends`
          );
        } else {
          // Remaining chunks: Use basic captions, queue for background processing
          console.log(
            `⏳ Using basic captions for chunk ${
              i + 1
            }, queuing for background processing...`
          );
          enhancedTrends = chunkTrends.map((trend) => ({
            ...trend,
            instagram_caption: `${trend.description} - ${trend.keypoints}`,
            facebook_caption: `${trend.description} - ${trend.keypoints}`,
            linkedin_caption: `${trend.description} - ${trend.keypoints}`,
            twitter_caption: `${trend.description} - ${trend.keypoints}`,
            tiktok_caption: `${trend.description} - ${trend.keypoints}`,
            youtube_caption: `${trend.description} - ${trend.keypoints}`,
            enhanced_with_dynamic_posts: false,
            caption_status: "pending", // Mark for background processing
          }));
        }

        allTrends.push(...enhancedTrends);
        console.log(
          `✅ Chunk ${i + 1} completed: ${enhancedTrends.length} trends`
        );

        // Add a small delay between chunks to avoid rate limiting
        if (i < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Error in chunk ${i + 1}:`, error);
        throw new Error(
          `Failed to generate trends in chunk ${i + 1}. Please try again.`
        );
      }
    }

    console.log(
      `✅ Generated ${allTrends.length} valid trends from OpenAI in ${totalChunks} chunks`
    );

    // Create scheduled trends
    const generatedTrends = this.createScheduledTrends(
      allTrends,
      scheduleData,
      startDate,
      endDate
    );

    // Create the schedule
    const schedule = new VideoSchedule({
      userId,
      email,
      timezone: scheduleData.timezone,
      frequency: scheduleData.frequency,
      schedule: scheduleData.schedule,
      isActive: true,
      startDate: startDate,
      endDate: endDate,
      generatedTrends,
    });

    await schedule.save();

    // Queue background job to generate dynamic captions for remaining videos
    this.queueBackgroundCaptionGeneration(
      schedule._id.toString(),
      userId,
      userSettings
    );

    // Send schedule created email
    try {
      const emailData: ScheduleEmailData = {
        userEmail: email,
        scheduleId: schedule._id.toString(),
        frequency: scheduleData.frequency,
        startDate: startDate,
        endDate: endDate,
        totalVideos: numberOfVideos,
        timezone: scheduleData.timezone, // Add timezone for email display
        schedule: scheduleData.schedule,
        videos: generatedTrends.map((trend) => ({
          description: trend.description,
          keypoints: trend.keypoints,
          scheduledFor: trend.scheduledFor,
          status: trend.status,
        })),
      };

      await this.emailService.sendScheduleCreatedEmail(emailData);
    } catch (emailError) {
      console.error("Error sending schedule created email:", emailError);
      // Don't fail the schedule creation if email fails
    }

    // Log success (no WebSocket notification)
    console.log(
      `✅ Video schedule created for user ${userId}: ${numberOfVideos} videos scheduled`
    );

    return schedule;
  }

  /**
   * Get user's active schedule
   */
  async getUserSchedule(userId: string): Promise<IVideoSchedule | null> {
    return await VideoSchedule.findOne({ userId, isActive: true });
  }

  /**
   * Update schedule
   */
  async updateSchedule(
    scheduleId: string,
    userId: string,
    updateData: Partial<ScheduleData>
  ): Promise<IVideoSchedule | null> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found");
    }

    // If frequency or dates are changing, regenerate trends
    if (updateData.frequency || updateData.startDate || updateData.endDate) {
      const newScheduleData = {
        frequency: updateData.frequency || schedule.frequency,
        schedule: updateData.schedule || schedule.schedule,
        startDate: updateData.startDate || schedule.startDate,
        endDate: updateData.endDate || schedule.endDate,
        timezone: updateData.timezone || schedule.timezone,
      };

      this.validateScheduleData(newScheduleData);

      const numberOfVideos = this.calculateNumberOfVideos(
        newScheduleData.frequency,
        newScheduleData.startDate,
        newScheduleData.endDate
      );

      const trends = await generateRealEstateTrends();
      const selectedTrends = trends.slice(0, numberOfVideos);

      schedule.generatedTrends = this.createScheduledTrends(
        selectedTrends,
        newScheduleData,
        newScheduleData.startDate,
        newScheduleData.endDate
      );
    }

    // Update other fields
    if (updateData.schedule) {
      schedule.schedule = updateData.schedule;
    }

    await schedule.save();
    return schedule;
  }

  /**
   * Deactivate schedule
   */
  async deactivateSchedule(
    scheduleId: string,
    userId: string
  ): Promise<boolean> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      return false;
    }

    schedule.isActive = false;
    await schedule.save();

    // Log deactivation (no WebSocket notification)
    console.log(`✅ Video schedule deactivated for user ${userId}`);

    return true;
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
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found or not active");
    }

    if (postIndex < 0 || postIndex >= schedule.generatedTrends.length) {
      throw new Error("Post index out of range");
    }

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error("Post not found");
    }

    // Only allow editing if post is still pending
    if (post.status !== "pending") {
      throw new Error("Can only edit pending posts");
    }

    // Update the post fields
    if (updateData.description !== undefined) {
      post.description = updateData.description;
    }
    if (updateData.keypoints !== undefined) {
      post.keypoints = updateData.keypoints;
    }
    if (updateData.scheduledFor !== undefined) {
      post.scheduledFor = updateData.scheduledFor;
    }
    if (updateData.instagram_caption !== undefined) {
      post.instagram_caption = updateData.instagram_caption;
    }
    if (updateData.facebook_caption !== undefined) {
      post.facebook_caption = updateData.facebook_caption;
    }
    if (updateData.linkedin_caption !== undefined) {
      post.linkedin_caption = updateData.linkedin_caption;
    }
    if (updateData.twitter_caption !== undefined) {
      post.twitter_caption = updateData.twitter_caption;
    }
    if (updateData.tiktok_caption !== undefined) {
      post.tiktok_caption = updateData.tiktok_caption;
    }
    if (updateData.youtube_caption !== undefined) {
      post.youtube_caption = updateData.youtube_caption;
    }

    // Save the updated schedule
    await schedule.save();

    console.log(
      `✅ Updated post ${postIndex} in schedule ${scheduleId} for user ${userId}`
    );

    return schedule;
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
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found or not active");
    }

    // Parse post ID to get index
    const parts = postId.split("_");
    if (parts.length !== 2) {
      throw new Error("Invalid post ID format");
    }

    const postIndex = parseInt(parts[1]);
    if (
      isNaN(postIndex) ||
      postIndex < 0 ||
      postIndex >= schedule.generatedTrends.length
    ) {
      throw new Error("Post not found");
    }

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error("Post not found");
    }

    // Only allow editing if post is still pending
    if (post.status !== "pending") {
      throw new Error("Can only edit pending posts");
    }

    // Update the post fields
    if (updateData.description !== undefined) {
      post.description = updateData.description;
    }
    if (updateData.keypoints !== undefined) {
      post.keypoints = updateData.keypoints;
    }
    if (updateData.scheduledFor !== undefined) {
      post.scheduledFor = updateData.scheduledFor;
    }
    if (updateData.instagram_caption !== undefined) {
      post.instagram_caption = updateData.instagram_caption;
    }
    if (updateData.facebook_caption !== undefined) {
      post.facebook_caption = updateData.facebook_caption;
    }
    if (updateData.linkedin_caption !== undefined) {
      post.linkedin_caption = updateData.linkedin_caption;
    }
    if (updateData.twitter_caption !== undefined) {
      post.twitter_caption = updateData.twitter_caption;
    }
    if (updateData.tiktok_caption !== undefined) {
      post.tiktok_caption = updateData.tiktok_caption;
    }
    if (updateData.youtube_caption !== undefined) {
      post.youtube_caption = updateData.youtube_caption;
    }

    // Save the updated schedule
    await schedule.save();

    console.log(
      `✅ Updated post ${postId} in schedule ${scheduleId} for user ${userId}`
    );

    return schedule;
  }

  /**
   * Delete individual post from a schedule
   */
  async deleteSchedulePost(
    scheduleId: string,
    postIndex: number,
    userId: string
  ): Promise<IVideoSchedule | null> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found or not active");
    }

    if (postIndex < 0 || postIndex >= schedule.generatedTrends.length) {
      throw new Error("Post index out of range");
    }

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error("Post not found");
    }

    // Allow deleting posts in any status (pending, completed, processing, failed)
    // This gives users flexibility to clean up their schedule
    console.log(`🗑️ Deleting post with status: ${post.status}`);

    // Remove the post from the array
    schedule.generatedTrends.splice(postIndex, 1);

    // Save the updated schedule
    await schedule.save();

    console.log(
      `🗑️ Deleted post ${postIndex} (status: ${post.status}) from schedule ${scheduleId} for user ${userId}`
    );

    return schedule;
  }

  /**
   * Delete individual post from a schedule by post ID
   */
  async deleteSchedulePostById(
    scheduleId: string,
    postId: string,
    userId: string
  ): Promise<IVideoSchedule | null> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found or not active");
    }

    // Parse post ID to get index
    const parts = postId.split("_");
    if (parts.length !== 2) {
      throw new Error("Invalid post ID format");
    }

    const postIndex = parseInt(parts[1]);
    if (
      isNaN(postIndex) ||
      postIndex < 0 ||
      postIndex >= schedule.generatedTrends.length
    ) {
      throw new Error("Post not found");
    }

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error("Post not found");
    }

    // Allow deleting posts in any status (pending, completed, processing, failed)
    // This gives users flexibility to clean up their schedule
    console.log(`🗑️ Deleting post with status: ${post.status}`);

    // Remove the post from the array
    schedule.generatedTrends.splice(postIndex, 1);

    // Save the updated schedule
    await schedule.save();

    console.log(
      `🗑️ Deleted post ${postId} (status: ${post.status}) from schedule ${scheduleId} for user ${userId}`
    );

    return schedule;
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
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found or not active");
    }

    if (postIndex < 0 || postIndex >= schedule.generatedTrends.length) {
      throw new Error("Post index out of range");
    }

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error("Post not found");
    }

    return {
      schedule,
      post,
      postIndex,
    };
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
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found or not active");
    }

    // Parse post ID to get index
    const parts = postId.split("_");
    if (parts.length !== 2) {
      throw new Error("Invalid post ID format");
    }

    const postIndex = parseInt(parts[1]);
    if (
      isNaN(postIndex) ||
      postIndex < 0 ||
      postIndex >= schedule.generatedTrends.length
    ) {
      throw new Error("Post not found");
    }

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error("Post not found");
    }

    return {
      schedule,
      post,
      postIndex,
    };
  }

  /**
   * Delete entire schedule
   */
  async deleteEntireSchedule(
    scheduleId: string,
    userId: string
  ): Promise<boolean> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found or not active");
    }

    // Delete the entire schedule document
    await VideoSchedule.findByIdAndDelete(scheduleId);

    console.log(`🗑️ Deleted entire schedule ${scheduleId} for user ${userId}`);

    return true;
  }

  /**
   * Helper method to calculate days until target day
   */
  private getDaysUntilTargetDay(currentDay: string, targetDay: string): number {
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const currentIndex = daysOfWeek.indexOf(currentDay);
    const targetIndex = daysOfWeek.indexOf(targetDay);

    if (targetIndex > currentIndex) {
      return targetIndex - currentIndex;
    } else if (targetIndex < currentIndex) {
      return 7 - (currentIndex - targetIndex);
    } else {
      return 7; // Same day, move to next week
    }
  }

  /**
   * Get pending videos for processing (30 minutes early)
   */
  async getPendingVideos(): Promise<IVideoSchedule[]> {
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    return await VideoSchedule.find({
      isActive: true,
      "generatedTrends.scheduledFor": {
        $gte: now,
        $lte: thirtyMinutesFromNow,
      },
      "generatedTrends.status": "pending",
    });
  }

  /**
   * Process scheduled video
   */
  async processScheduledVideo(
    scheduleId: string,
    trendIndex: number,
    userSettings: any
  ): Promise<void> {
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    const trend = schedule.generatedTrends[trendIndex];
    if (!trend) {
      throw new Error("Trend not found");
    }

    // Update status to processing
    schedule.generatedTrends[trendIndex].status = "processing";
    await schedule.save();

    // Send processing started email
    try {
      const processingEmailData: VideoProcessingEmailData = {
        userEmail: schedule.email,
        scheduleId: schedule._id.toString(),
        videoTitle: trend.description,
        videoDescription: trend.description,
        videoKeypoints: trend.keypoints,
        startedAt: new Date(),
        timezone: schedule.timezone, // Add timezone for email display
      };

      await this.emailService.sendVideoProcessingEmail(processingEmailData);
    } catch (emailError) {
      console.error("Error sending video processing email:", emailError);
      // Don't fail the processing if email fails
    }

    // Send socket notification - Video processing started
    notificationService.notifyScheduledVideoProgress(
      schedule.userId.toString(),
      "video-creation",
      "progress",
      {
        message: `Scheduled video "${trend.description}" is being created`,
        scheduleId: scheduleId,
        trendIndex: trendIndex,
        videoTitle: trend.description,
      }
    );

    try {
      // Generate social media captions using OpenAI
      console.log("🎨 Generating social media captions...");
      const captions =
        await CaptionGenerationService.generateScheduledVideoCaptions(
          trend.description,
          trend.keypoints,
          {
            name: userSettings.name,
            position: userSettings.position,
            companyName: userSettings.companyName,
            city: userSettings.city,
            socialHandles: userSettings.socialHandles,
          }
        );
      console.log("✅ Captions generated successfully");

      // Create video using existing video generation logic (NO CAPTIONS in webhook)
      const videoData = {
        hook: trend.description,
        body: trend.keypoints,
        conclusion:
          "Contact us for more information about real estate opportunities.",
        company_name: userSettings.companyName,
        social_handles: userSettings.socialHandles,
        license: userSettings.license,
        avatar_title: userSettings.titleAvatar,
        avatar_body: userSettings.avatar[0] || userSettings.avatar[0],
        avatar_conclusion: userSettings.conclusionAvatar,
        email: userSettings.email,
        title: trend.description,
        // Store captions for later retrieval (not sent to webhook)
        _captions: captions,
      };

      // ==================== STEP 1: CREATE VIDEO (PROMPT GENERATION) ====================
      console.log("🎬 Step 1: Creating video (prompt generation)...");
      console.log("📋 API Endpoint: POST /api/video/create");

      // Get gender from avatar settings
      const DefaultAvatar = require("../models/avatar").default;
      const avatarDoc = await DefaultAvatar.findOne({
        avatar_id: userSettings.titleAvatar,
      });
      const gender = avatarDoc ? avatarDoc.gender : undefined;

      // Get voice_id from gender
      let voice_id: string | undefined = undefined;
      if (gender) {
        const DefaultVoice = require("../models/voice").default;
        const voiceDoc = await DefaultVoice.findOne({ gender });
        voice_id = voiceDoc ? voiceDoc.voice_id : undefined;
      }

      // Step 1: Prepare data for video creation API (same format as manual)
      const videoCreationData = {
        prompt: userSettings.prompt,
        avatar: userSettings.avatar,
        name: userSettings.name,
        position: userSettings.position,
        companyName: userSettings.companyName,
        license: userSettings.license,
        tailoredFit: userSettings.tailoredFit,
        socialHandles: userSettings.socialHandles,
        videoTopic: trend.description,
        topicKeyPoints: trend.keypoints,
        city: userSettings.city,
        preferredTone: userSettings.preferredTone,
        zipCode: 90014,
        zipKeyPoints: "new bars and restaurants",
        callToAction: userSettings.callToAction,
        email: userSettings.email,
        timestamp: new Date().toISOString(),
        requestId: `scheduled_video_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        isScheduled: true,
        scheduleId: scheduleId,
        trendIndex: trendIndex,
      };

      // Call Step 1: Create Video API endpoint (same as manual)
      console.log("🔄 Step 1: Calling Create Video API...");
      console.log(
        "📋 Request Body:",
        JSON.stringify(videoCreationData, null, 2)
      );

      let enhancedContent: any = null;
      try {
        enhancedContent = await this.callCreateVideoAPI(videoCreationData);
        console.log("✅ Step 1: Create Video API completed successfully");
        console.log(
          "📋 Enhanced content received:",
          JSON.stringify(enhancedContent, null, 2)
        );

        // Validate that we have the required enhanced content
        if (
          !enhancedContent ||
          !enhancedContent.hook ||
          !enhancedContent.body ||
          !enhancedContent.conclusion
        ) {
          throw new Error(
            "Enhanced content is incomplete or missing from first API response"
          );
        }
      } catch (error: any) {
        console.error("❌ Step 1: Create Video API failed:", error);
        throw new Error(`Create Video API failed: ${error.message}`);
      }

      // Wait a moment between API calls
      console.log("⏳ Waiting 2 seconds before Step 2...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // ==================== STEP 2: GENERATE VIDEO (VIDEO CREATION) ====================
      console.log("🎬 Step 2: Generating video (video creation)...");
      console.log("📋 API Endpoint: POST /api/video/generate-video");

      // Extract avatar IDs from userSettings (handle both string and object formats)
      // userSettings can have avatars as strings (avatar_id) or objects ({avatar_id, avatarType})
      const extractAvatarId = (avatarValue: any): string => {
        if (!avatarValue) return "";
        if (typeof avatarValue === "string") return avatarValue.trim();
        if (typeof avatarValue === "object" && avatarValue !== null && avatarValue.avatar_id) {
          return String(avatarValue.avatar_id).trim();
        }
        return String(avatarValue).trim();
      };

      const titleAvatarId = extractAvatarId(userSettings.titleAvatar);
      // Use bodyAvatar if available, otherwise fall back to avatar[0] for backward compatibility
      const bodyAvatarId = extractAvatarId(userSettings.bodyAvatar);
      const conclusionAvatarId = extractAvatarId(userSettings.conclusionAvatar);

      // Step 2: Prepare data for video generation API using ONLY enhanced content from Step 1
      const videoGenerationData = {
        hook: enhancedContent.hook, // ONLY use enhanced hook from Step 1
        body: enhancedContent.body, // ONLY use enhanced body from Step 1
        conclusion: enhancedContent.conclusion, // ONLY use enhanced conclusion from Step 1
        company_name: userSettings.companyName,
        social_handles: userSettings.socialHandles,
        license: userSettings.license,
        avatar_title: titleAvatarId, // Extract avatar_id (string) so generateVideo API can resolve avatarType
        avatar_body: bodyAvatarId, // Extract avatar_id (string) so generateVideo API can resolve avatarType
        avatar_conclusion: conclusionAvatarId, // Extract avatar_id (string) so generateVideo API can resolve avatarType
        email: userSettings.email,
        title: trend.description,
        voice: voice_id,
        isDefault: avatarDoc?.default,
        timestamp: new Date().toISOString(),
        isScheduled: true,
        scheduleId: scheduleId,
        trendIndex: trendIndex,
        // Store captions for later retrieval (not sent to webhook)
        _captions: captions,
      };

      // Call Step 2: Generate Video API endpoint (same as manual)
      console.log("🔄 Step 2: Calling Generate Video API...");
      console.log(
        "📋 Request Body:",
        JSON.stringify(videoGenerationData, null, 2)
      );
      try {
        await this.callGenerateVideoAPI(videoGenerationData);
        console.log("✅ Step 2: Generate Video API completed successfully");
      } catch (error: any) {
        console.error("❌ Step 2: Generate Video API failed:", error);
        throw new Error(`Generate Video API failed: ${error.message}`);
      }

      // Log processing completion
      console.log("🎉 Both API calls completed successfully!");
      console.log(
        `🎬 Scheduled video processing initiated: "${trend.description}" for user ${schedule.userId}`
      );
      console.log(
        "📱 Video will be processed and auto-posted to social media when ready"
      );

      // Send socket notification - Video creation initiated successfully
      notificationService.notifyScheduledVideoProgress(
        schedule.userId.toString(),
        "video-creation",
        "success",
        {
          message: `Video "${trend.description}" creation initiated successfully`,
          scheduleId: scheduleId,
          trendIndex: trendIndex,
          videoTitle: trend.description,
          nextStep: "Video will be processed and auto-posted when ready",
        }
      );
    } catch (error: any) {
      console.error("Error processing scheduled video:", error);
      schedule.generatedTrends[trendIndex].status = "failed";
      await schedule.save();

      // Send socket notification - Video creation failed
      notificationService.notifyScheduledVideoProgress(
        schedule.userId.toString(),
        "video-creation",
        "error",
        {
          message: `Failed to create video "${trend.description}": ${error.message}`,
          scheduleId: scheduleId,
          trendIndex: trendIndex,
          videoTitle: trend.description,
          error: error.message,
        }
      );

      // Log failure
      console.error(
        `❌ Failed to process scheduled video "${trend.description}" for user ${schedule.userId}:`,
        error.message
      );
    }
  }

  /**
   * Call Step 1: Create Video API endpoint (same as manual)
   */
  private async callCreateVideoAPI(data: any): Promise<any> {
    const baseUrl =
      process.env.API_BASE_URL || "https://backend.edgeairealty.com";
    const createVideoUrl = `${baseUrl}/api/video/create`;

    console.log("🌐 Making API call to create video...");
    console.log(`📋 URL: ${createVideoUrl}`);
    console.log(`📋 Method: POST`);
    console.log(`📋 Headers: Content-Type: application/json`);

    return new Promise<any>((resolve, reject) => {
      const https = require("https");
      const http = require("http");
      const url = require("url");
      const parsedUrl = url.parse(createVideoUrl);
      const postData = JSON.stringify(data);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const request = (parsedUrl.protocol === "https:" ? https : http).request(
        options,
        (res: any) => {
          let responseData = "";
          res.on("data", (chunk: any) => {
            responseData += chunk;
          });
          res.on("end", () => {
            console.log(
              `📋 Step 1: Create Video API Response Status: ${res.statusCode}`
            );
            console.log(
              `📋 Step 1: Create Video API Response Body:`,
              responseData
            );

            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log("✅ Step 1: Create Video API called successfully");

              // Parse the response to extract enhanced content
              try {
                const response = JSON.parse(responseData);

                // Extract enhanced content from webhookResponse (URL-encoded)
                const webhookResponse = response.data?.webhookResponse;
                if (webhookResponse) {
                  const enhancedContent = {
                    hook: decodeURIComponent(webhookResponse.hook || "")
                      .replace(/\\n\\n/g, " ")
                      .replace(/\n\n/g, " ")
                      .replace(/\\n/g, " ")
                      .replace(/\n/g, " ")
                      .trim(),
                    body: decodeURIComponent(webhookResponse.body || "")
                      .replace(/\\n\\n/g, " ")
                      .replace(/\n\n/g, " ")
                      .replace(/\\n/g, " ")
                      .replace(/\n/g, " ")
                      .trim(),
                    conclusion: decodeURIComponent(
                      webhookResponse.conclusion || ""
                    )
                      .replace(/\\n\\n/g, " ")
                      .replace(/\n\n/g, " ")
                      .replace(/\\n/g, " ")
                      .replace(/\n/g, " ")
                      .trim(),
                  };
                  console.log(
                    "📋 Extracted enhanced content:",
                    enhancedContent
                  );
                  resolve(enhancedContent);
                } else {
                  console.warn("⚠️ No webhookResponse found in API response");
                  resolve(null);
                }
              } catch (parseError) {
                console.warn(
                  "⚠️ Could not parse enhanced content from response, using fallback"
                );
                resolve(null);
              }
            } else {
              console.error(
                `❌ Step 1: Create Video API failed with status ${res.statusCode}:`,
                responseData
              );
              reject(new Error(`Create Video API failed: ${res.statusCode}`));
            }
          });
        }
      );

      request.on("error", (error: any) => {
        console.error("❌ Step 1: Create Video API request failed:", error);
        console.error(`📋 Error details: ${error.message}`);
        console.error(`📋 Error code: ${error.code}`);
        reject(error);
      });

      request.write(postData);
      request.end();
    });
  }

  /**
   * Call Step 2: Generate Video API endpoint (same as manual)
   */
  private async callGenerateVideoAPI(data: any): Promise<void> {
    const baseUrl =
      process.env.API_BASE_URL || "https://backend.edgeairealty.com";
    const generateVideoUrl = `${baseUrl}/api/video/generate-video`;

    console.log("🌐 Making API call to generate video...");
    console.log(`📋 URL: ${generateVideoUrl}`);
    console.log(`📋 Method: POST`);
    console.log(`📋 Headers: Content-Type: application/json`);

    return new Promise<void>((resolve, reject) => {
      const https = require("https");
      const http = require("http");
      const url = require("url");
      const parsedUrl = url.parse(generateVideoUrl);
      const postData = JSON.stringify(data);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const request = (parsedUrl.protocol === "https:" ? https : http).request(
        options,
        (res: any) => {
          let responseData = "";
          res.on("data", (chunk: any) => {
            responseData += chunk;
          });
          res.on("end", () => {
            console.log(
              `📋 Step 2: Generate Video API Response Status: ${res.statusCode}`
            );
            console.log(
              `📋 Step 2: Generate Video API Response Body:`,
              responseData
            );

            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log("✅ Step 2: Generate Video API called successfully");
              resolve();
            } else {
              console.error(
                `❌ Step 2: Generate Video API failed with status ${res.statusCode}:`,
                responseData
              );
              reject(new Error(`Generate Video API failed: ${res.statusCode}`));
            }
          });
        }
      );

      request.on("error", (error: any) => {
        console.error("❌ Step 2: Generate Video API request failed:", error);
        console.error(`📋 Error details: ${error.message}`);
        console.error(`📋 Error code: ${error.code}`);
        reject(error);
      });

      request.write(postData);
      request.end();
    });
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
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    if (schedule.generatedTrends[trendIndex]) {
      schedule.generatedTrends[trendIndex].status = status;
      if (videoId) {
        schedule.generatedTrends[trendIndex].videoId = videoId;
      }
      await schedule.save();

      const trend = schedule.generatedTrends[trendIndex];

      // Send email notification for completed videos
      if (status === "completed") {
        try {
          // Check if this is the last video in the schedule
          const completedVideos = schedule.generatedTrends.filter(
            (t: any) => t.status === "completed"
          ).length;
          const totalVideos = schedule.generatedTrends.length;
          const isLastVideo = completedVideos === totalVideos;

          const emailData: VideoGeneratedEmailData = {
            userEmail: schedule.email,
            scheduleId: schedule._id.toString(),
            videoTitle: trend.description,
            videoDescription: trend.description,
            videoKeypoints: trend.keypoints,
            generatedAt: new Date(),
            videoId: videoId,
            isLastVideo: isLastVideo,
            timezone: schedule.timezone, // Add timezone for email display
          };

          await this.emailService.sendVideoGeneratedEmail(emailData);
        } catch (emailError) {
          console.error("Error sending video generated email:", emailError);
          // Don't fail the status update if email fails
        }
      }

      // Log status update (no WebSocket notification)
      const statusMessage =
        status === "completed"
          ? `✅ Scheduled video "${trend.description}" completed for user ${schedule.userId}`
          : `❌ Scheduled video "${trend.description}" failed for user ${schedule.userId}`;

      console.log(statusMessage);
    }
  }

  /**
   * Validate schedule data
   */
  private validateScheduleData(scheduleData: ScheduleData): void {
    const { frequency, schedule } = scheduleData;

    // Validate frequency-specific requirements
    switch (frequency) {
      case "once_week":
        if (schedule.days.length !== 1 || schedule.times.length !== 1) {
          throw new Error("Once a week requires exactly 1 day and 1 time");
        }
        break;
      case "twice_week":
        if (schedule.days.length !== 2 || schedule.times.length !== 2) {
          throw new Error("Twice a week requires exactly 2 days and 2 times");
        }
        break;
      case "three_week":
        if (schedule.days.length !== 3 || schedule.times.length !== 3) {
          throw new Error(
            "Three times a week requires exactly 3 days and 3 times"
          );
        }
        break;
      case "daily":
        if (schedule.days.length !== 0 || schedule.times.length !== 1) {
          throw new Error("Daily requires exactly 1 time and no specific days");
        }
        break;
    }

    // Validate time format
    schedule.times.forEach((time) => {
      if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        throw new Error(`Invalid time format: ${time}. Use HH:MM format.`);
      }
    });

    // Validate days
    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    schedule.days.forEach((day) => {
      if (!validDays.includes(day)) {
        throw new Error(`Invalid day: ${day}`);
      }
    });
  }

  /**
   * Calculate number of videos needed based on frequency and duration
   * Ensures we calculate for the full month period
   */
  private calculateNumberOfVideos(
    frequency: string,
    startDate: Date,
    endDate: Date
  ): number {
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weeks = Math.ceil(daysDiff / 7);

    console.log(`📊 Calculating videos for ${frequency}:`);
    console.log(
      `📅 Period: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );
    console.log(`📅 Days: ${daysDiff}, Weeks: ${weeks}`);

    let numberOfVideos = 0;

    switch (frequency) {
      case "once_week":
        numberOfVideos = weeks;
        console.log(`📊 Once per week: ${numberOfVideos} videos`);
        break;
      case "twice_week":
        numberOfVideos = weeks * 2;
        console.log(`📊 Twice per week: ${numberOfVideos} videos`);
        break;
      case "three_week":
        numberOfVideos = weeks * 3;
        console.log(`📊 Three times per week: ${numberOfVideos} videos`);
        break;
      case "daily":
        numberOfVideos = daysDiff;
        console.log(`📊 Daily: ${numberOfVideos} videos`);
        break;
      default:
        numberOfVideos = 1;
        console.log(`📊 Default: ${numberOfVideos} videos`);
    }

    console.log(`📊 Total videos to generate: ${numberOfVideos}`);
    return numberOfVideos;
  }

  /**
   * Create scheduled trends with proper timing
   * Handles edge case: if scheduled time is less than 40 minutes away, skip that day
   */
  private createScheduledTrends(
    trends: any[],
    scheduleData: ScheduleData,
    startDate: Date,
    endDate: Date
  ): any[] {
    const scheduledTrends = [];
    const { frequency, schedule, timezone } = scheduleData;

    let currentDate = new Date(startDate);
    let trendIndex = 0;
    const now = new Date();

    console.log(
      `📅 Creating scheduled trends from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );
    console.log(`🕐 Current time: ${now.toISOString()}`);
    console.log(`🌍 User timezone: ${timezone}`);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.toLocaleDateString("en-US", {
        weekday: "long",
      });

      console.log(
        `📅 Checking date: ${currentDate.toISOString()} (${dayOfWeek})`
      );

      // Check if this day should have a video
      let shouldSchedule = false;
      let timeIndex = 0;

      if (frequency === "daily") {
        shouldSchedule = true;
        timeIndex = 0;
      } else {
        const dayIndex = schedule.days.findIndex((day) => day === dayOfWeek);
        if (dayIndex !== -1) {
          shouldSchedule = true;
          timeIndex = dayIndex;
        }
      }

      if (shouldSchedule) {
        const [hours, minutes] = schedule.times[timeIndex]
          .split(":")
          .map(Number);

        // Create the scheduled time by combining the current date with the scheduled time
        // in the user's timezone, then convert to UTC
        const dateString = currentDate.toISOString().split("T")[0]; // Get YYYY-MM-DD
        const timeString = `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:00`;
        const localDateTime = `${dateString} ${timeString}`;

        // Convert from user's timezone to UTC (avoid double-conversion, and skip if timezone is UTC)
        const finalScheduledTime =
          timezone === "UTC"
            ? new Date(`${dateString}T${timeString}Z`)
            : TimezoneService.ensureUTCDate(localDateTime, timezone);

        console.log(`📅 Local datetime: ${localDateTime} (${timezone})`);
        console.log(
          `📅 Final scheduled time (UTC): ${finalScheduledTime.toISOString()}`
        );

        // Edge case handling: Check if scheduled time is less than 40 minutes away
        const shouldSkipDay = this.shouldSkipScheduledDay(
          finalScheduledTime,
          now,
          dayOfWeek,
          schedule.times[timeIndex]
        );

        if (shouldSkipDay) {
          // Skip this day, move to next day
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Use unique trend (no cycling since we have exactly the number needed)
        const trendToUse = trends[trendIndex];

        if (!trendToUse) {
          console.log(
            `📊 No more trends available at index ${trendIndex}. Total trends: ${trends.length}`
          );
          console.log(
            `📊 Created ${scheduledTrends.length} scheduled trends from ${trends.length} available trends`
          );
          break; // Stop creating more posts when we run out of trends
        }

        // Validate that the trend has all required fields
        if (
          !trendToUse.description ||
          !trendToUse.keypoints ||
          !trendToUse.instagram_caption ||
          !trendToUse.facebook_caption ||
          !trendToUse.linkedin_caption ||
          !trendToUse.twitter_caption ||
          !trendToUse.tiktok_caption ||
          !trendToUse.youtube_caption
        ) {
          console.error(
            `❌ Invalid trend data at index ${trendIndex}:`,
            trendToUse
          );
          throw new Error(
            `Trend at index ${trendIndex} is missing required fields`
          );
        }

        scheduledTrends.push({
          ...trendToUse,
          scheduledFor: finalScheduledTime, // Use UTC time
          status: "pending",
        });

        trendIndex++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(
      `📊 Created ${scheduledTrends.length} scheduled trends from ${trends.length} available trends`
    );
    console.log(
      `📊 Used ${Math.min(
        scheduledTrends.length,
        trends.length
      )} unique trends (no cycling)`
    );
    return scheduledTrends;
  }

  /**
   * Create immediate scheduled posts for frequency updates
   * Only creates posts for the next few upcoming schedule slots
   */
  private createImmediateScheduledPosts(
    trends: any[],
    scheduleData: ScheduleData,
    startDate: Date
  ): any[] {
    const scheduledTrends = [];
    const { frequency, schedule } = scheduleData;
    let trendIndex = 0;
    const now = new Date();

    console.log(
      `📅 Creating immediate scheduled posts from ${startDate.toISOString()}`
    );
    console.log(`📊 Available trends: ${trends.length}`);

    // Create posts for the next few upcoming schedule slots
    let currentDate = new Date(startDate);
    let postsCreated = 0;
    const maxPostsToCreate = Math.min(trends.length, 10); // Limit to reasonable number

    while (postsCreated < maxPostsToCreate && trendIndex < trends.length) {
      const dayOfWeek = currentDate
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase();

      // Check if this day should have a video
      let shouldSchedule = false;
      let timeIndex = 0;

      if (frequency === "daily") {
        shouldSchedule = true;
        timeIndex = 0;
      } else {
        const dayIndex = schedule.days.findIndex(
          (day) => day.toLowerCase() === dayOfWeek
        );
        if (dayIndex !== -1) {
          shouldSchedule = true;
          timeIndex = dayIndex;
        }
      }

      if (shouldSchedule) {
        const [hours, minutes] = schedule.times[timeIndex]
          .split(":")
          .map(Number);

        const finalScheduledTime = new Date(currentDate);
        finalScheduledTime.setUTCHours(hours, minutes, 0, 0);

        // Skip if the time is too close to now
        const timeDiff = finalScheduledTime.getTime() - now.getTime();
        if (timeDiff < 40 * 60 * 1000) {
          // Less than 40 minutes
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const trendToUse = trends[trendIndex];
        if (!trendToUse) {
          console.log(`📊 No more trends available at index ${trendIndex}`);
          break;
        }

        scheduledTrends.push({
          ...trendToUse,
          scheduledFor: finalScheduledTime,
          status: "pending",
        });

        trendIndex++;
        postsCreated++;
        console.log(
          `📅 Created post ${postsCreated} for ${dayOfWeek} at ${finalScheduledTime.toISOString()}`
        );
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(
      `📊 Created ${scheduledTrends.length} immediate scheduled posts`
    );
    return scheduledTrends;
  }

  /**
   * Check if a scheduled day should be skipped based on edge case rules
   * Skips if scheduled time is less than 40 minutes away from current time
   */
  private shouldSkipScheduledDay(
    scheduledTime: Date,
    currentTime: Date,
    dayOfWeek: string,
    scheduledTimeString: string
  ): boolean {
    const timeDiff = scheduledTime.getTime() - currentTime.getTime();
    const minutesUntilScheduled = timeDiff / (1000 * 60); // Convert to minutes

    console.log(
      `📅 Checking ${dayOfWeek} ${scheduledTimeString}: ${minutesUntilScheduled.toFixed(
        1
      )} minutes until scheduled time`
    );

    // Edge case: If scheduled time is less than 40 minutes away, skip this day
    if (minutesUntilScheduled < 40) {
      console.log(
        `⏰ Skipping ${dayOfWeek} ${scheduledTimeString} - less than 40 minutes away (${minutesUntilScheduled.toFixed(
          1
        )} minutes)`
      );
      return true;
    }

    console.log(
      `✅ Scheduling ${dayOfWeek} ${scheduledTimeString} - ${minutesUntilScheduled.toFixed(
        1
      )} minutes away`
    );
    return false;
  }

  /**
   * Generate dynamic captions for trends using Enhanced Dynamic Template System
   */
  private async generateDynamicCaptionsForTrends(
    trends: any[],
    userSettings: any,
    userId: string
  ): Promise<any[]> {
    console.log(
      `🎯 Generating dynamic captions for ${trends.length} trends during schedule creation...`
    );

    const enhancedTrends = [];

    for (const trend of trends) {
      try {
        // Create user context from user settings
        const userContext = {
          name: userSettings.name,
          position: userSettings.position,
          companyName: userSettings.companyName,
          city: userSettings.city,
          socialHandles: userSettings.socialHandles,
        };

        // Generate dynamic posts for this trend
        const { DynamicPostGenerationService } = await import(
          "./dynamicPostGeneration.service"
        );
        const dynamicPosts =
          await DynamicPostGenerationService.generateDynamicPosts(
            trend.description,
            trend.keypoints,
            userContext,
            userId,
            [
              "instagram",
              "facebook",
              "linkedin",
              "twitter",
              "tiktok",
              "youtube",
            ]
          );

        // Create enhanced trend with dynamic captions
        const enhancedTrend = {
          ...trend,
          // Update captions with dynamic content
          instagram_caption: this.getDynamicCaption(dynamicPosts, "instagram"),
          facebook_caption: this.getDynamicCaption(dynamicPosts, "facebook"),
          linkedin_caption: this.getDynamicCaption(dynamicPosts, "linkedin"),
          twitter_caption: this.getDynamicCaption(dynamicPosts, "twitter"),
          tiktok_caption: this.getDynamicCaption(dynamicPosts, "tiktok"),
          youtube_caption: this.getDynamicCaption(dynamicPosts, "youtube"),
          // Add metadata
          enhanced_with_dynamic_posts: true,
          enhancement_timestamp: new Date().toISOString(),
        };

        enhancedTrends.push(enhancedTrend);
        console.log(
          `✅ Generated dynamic captions for trend: "${trend.description}"`
        );
      } catch (error) {
        console.warn(
          `⚠️ Failed to generate dynamic captions for trend "${trend.description}":`,
          error
        );
        // Keep original trend if enhancement fails
        enhancedTrends.push({
          ...trend,
          enhanced_with_dynamic_posts: false,
          enhancement_error:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return enhancedTrends;
  }

  /**
   * Queue background job to generate dynamic captions for ALL videos (async version)
   */
  private queueBackgroundCaptionGenerationAsync(
    scheduleId: string,
    userId: string,
    userSettings: any,
    totalVideos: number
  ): void {
    console.log(
      `🔄 Queuing background caption generation for ${totalVideos} videos...`
    );

    // Process all videos in background
    setImmediate(async () => {
      try {
        await this.processAllBackgroundCaptions(
          scheduleId,
          userId,
          userSettings,
          totalVideos
        );
      } catch (error: any) {
        console.error("❌ Background caption generation failed:", error);

        // Update schedule status to failed
        await VideoSchedule.findByIdAndUpdate(scheduleId, {
          status: "failed",
        });

        // Send failure notification
        const { notificationService } = await import("./notification.service");
        notificationService.notifyScheduleStatus(userId, "failed", {
          scheduleId,
          message: "Schedule creation failed",
          totalVideos,
          processedVideos: 0,
          errorDetails: error.message,
        });
      }
    });
  }

  /**
   * Process all background captions with progress updates
   */
  private async processAllBackgroundCaptions(
    scheduleId: string,
    userId: string,
    userSettings: any,
    totalVideos: number
  ): Promise<void> {
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    const { notificationService } = await import("./notification.service");
    let processedCount = 0;

    console.log(
      `🎯 Starting background caption generation for ${totalVideos} videos...`
    );

    // Process videos in batches of 3 to avoid rate limiting
    const batchSize = 3;
    const totalBatches = Math.ceil(totalVideos / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalVideos);

      console.log(
        `📦 Processing batch ${batchIndex + 1}/${totalBatches} (videos ${
          startIndex + 1
        }-${endIndex})...`
      );

      // Process videos in this batch
      const batchPromises = [];
      for (let i = startIndex; i < endIndex; i++) {
        if (schedule.generatedTrends[i]) {
          batchPromises.push(
            this.generateDynamicCaptionsForSingleTrend(
              schedule.generatedTrends[i],
              userSettings,
              userId,
              scheduleId,
              i
            )
          );
        }
      }

      try {
        await Promise.all(batchPromises);
        processedCount = endIndex;

        console.log(
          `✅ Batch ${
            batchIndex + 1
          } completed: ${processedCount}/${totalVideos} videos processed`
        );

        // Send progress notification
        notificationService.notifyScheduleStatus(userId, "processing", {
          scheduleId,
          message: "Generating dynamic captions...",
          totalVideos,
          processedVideos: processedCount,
        });

        // Add delay between batches to avoid rate limiting
        if (batchIndex < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`❌ Error in batch ${batchIndex + 1}:`, error);
        // Continue with next batch
      }
    }

    // Update schedule status to ready
    await VideoSchedule.findByIdAndUpdate(scheduleId, {
      status: "ready",
    });

    // Send completion notification
    notificationService.notifyScheduleStatus(userId, "ready", {
      scheduleId,
      message: "Schedule creation completed successfully",
      totalVideos,
      processedVideos: totalVideos,
    });

    console.log(
      `🎉 Background caption generation completed for schedule ${scheduleId}`
    );
  }

  /**
   * Generate dynamic captions for a single trend
   */
  private async generateDynamicCaptionsForSingleTrend(
    trend: any,
    userSettings: any,
    userId: string,
    scheduleId: string,
    trendIndex: number
  ): Promise<void> {
    try {
      // Create user context from user settings
      const userContext = {
        name: userSettings.name,
        position: userSettings.position,
        companyName: userSettings.companyName,
        city: userSettings.city,
        socialHandles: userSettings.socialHandles,
      };

      // Generate dynamic posts for this trend
      const { DynamicPostGenerationService } = await import(
        "./dynamicPostGeneration.service"
      );
      const dynamicPosts =
        await DynamicPostGenerationService.generateDynamicPosts(
          trend.description,
          trend.keypoints,
          userContext,
          userId,
          ["instagram", "facebook", "linkedin", "twitter", "tiktok", "youtube"]
        );

      // Update captions with dynamic content
      const updatedCaptions = {
        instagram_caption: this.getDynamicCaption(dynamicPosts, "instagram"),
        facebook_caption: this.getDynamicCaption(dynamicPosts, "facebook"),
        linkedin_caption: this.getDynamicCaption(dynamicPosts, "linkedin"),
        twitter_caption: this.getDynamicCaption(dynamicPosts, "twitter"),
        tiktok_caption: this.getDynamicCaption(dynamicPosts, "tiktok"),
        youtube_caption: this.getDynamicCaption(dynamicPosts, "youtube"),
        enhanced_with_dynamic_posts: true,
        caption_status: "ready",
        caption_processed_at: new Date(),
      };

      // Update the specific trend in the schedule
      await VideoSchedule.findByIdAndUpdate(scheduleId, {
        $set: {
          [`generatedTrends.${trendIndex}.instagram_caption`]:
            updatedCaptions.instagram_caption,
          [`generatedTrends.${trendIndex}.facebook_caption`]:
            updatedCaptions.facebook_caption,
          [`generatedTrends.${trendIndex}.linkedin_caption`]:
            updatedCaptions.linkedin_caption,
          [`generatedTrends.${trendIndex}.twitter_caption`]:
            updatedCaptions.twitter_caption,
          [`generatedTrends.${trendIndex}.tiktok_caption`]:
            updatedCaptions.tiktok_caption,
          [`generatedTrends.${trendIndex}.youtube_caption`]:
            updatedCaptions.youtube_caption,
          [`generatedTrends.${trendIndex}.enhanced_with_dynamic_posts`]:
            updatedCaptions.enhanced_with_dynamic_posts,
          [`generatedTrends.${trendIndex}.caption_status`]:
            updatedCaptions.caption_status,
          [`generatedTrends.${trendIndex}.caption_processed_at`]:
            updatedCaptions.caption_processed_at,
        },
      });

      console.log(
        `✅ Generated dynamic captions for trend ${trendIndex + 1}: "${
          trend.description
        }"`
      );
    } catch (error: any) {
      console.error(
        `❌ Failed to generate dynamic captions for trend ${trendIndex + 1}:`,
        error
      );

      // Mark as failed but continue processing others
      await VideoSchedule.findByIdAndUpdate(scheduleId, {
        $set: {
          [`generatedTrends.${trendIndex}.caption_status`]: "failed",
          [`generatedTrends.${trendIndex}.caption_error`]: error.message,
        },
      });
    }
  }

  /**
   * Queue background job to generate dynamic captions for remaining videos
   */
  private queueBackgroundCaptionGeneration(
    scheduleId: string,
    userId: string,
    userSettings: any
  ): void {
    console.log(
      `🚀 Queuing background caption generation for schedule ${scheduleId}`
    );

    // Start background processing immediately (non-blocking)
    setImmediate(async () => {
      try {
        console.log(
          `🔄 Starting background caption generation for schedule ${scheduleId}...`
        );
        await this.processBackgroundCaptions(scheduleId, userId, userSettings);
        console.log(
          `✅ Background caption generation completed for schedule ${scheduleId}`
        );
      } catch (error) {
        console.error(
          `❌ Background caption generation failed for schedule ${scheduleId}:`,
          error
        );
      }
    });

    console.log(
      `📋 Background caption generation queued for schedule ${scheduleId}`
    );
    console.log(`⏰ Enhanced captions will be available within 5-10 minutes`);
  }

  /**
   * Process background caption generation for pending videos
   */
  private async processBackgroundCaptions(
    scheduleId: string,
    userId: string,
    userSettings: any
  ): Promise<void> {
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    const pendingTrends = schedule.generatedTrends.filter(
      (trend: any) => trend.caption_status === "pending"
    );

    console.log(
      `📊 Found ${pendingTrends.length} videos pending caption generation`
    );

    for (let i = 0; i < pendingTrends.length; i++) {
      const trendIndex = schedule.generatedTrends.findIndex(
        (t: any) => t.description === pendingTrends[i].description
      );

      try {
        console.log(
          `🎯 Processing video ${i + 1}/${pendingTrends.length}: "${
            pendingTrends[i].description
          }"`
        );

        // Generate dynamic captions for this trend
        const userContext = {
          name: userSettings.name,
          position: userSettings.position,
          companyName: userSettings.companyName,
          city: userSettings.city,
          socialHandles: userSettings.socialHandles,
        };

        const { DynamicPostGenerationService } = await import(
          "./dynamicPostGeneration.service"
        );
        const dynamicPosts =
          await DynamicPostGenerationService.generateDynamicPosts(
            pendingTrends[i].description,
            pendingTrends[i].keypoints,
            userContext,
            userId,
            [
              "instagram",
              "facebook",
              "linkedin",
              "twitter",
              "tiktok",
              "youtube",
            ]
          );

        // Update trend with dynamic captions
        schedule.generatedTrends[trendIndex].instagram_caption =
          dynamicPosts.find((p) => p.platform === "instagram")?.content ||
          schedule.generatedTrends[trendIndex].instagram_caption;
        schedule.generatedTrends[trendIndex].facebook_caption =
          dynamicPosts.find((p) => p.platform === "facebook")?.content ||
          schedule.generatedTrends[trendIndex].facebook_caption;
        schedule.generatedTrends[trendIndex].linkedin_caption =
          dynamicPosts.find((p) => p.platform === "linkedin")?.content ||
          schedule.generatedTrends[trendIndex].linkedin_caption;
        schedule.generatedTrends[trendIndex].twitter_caption =
          dynamicPosts.find((p) => p.platform === "twitter")?.content ||
          schedule.generatedTrends[trendIndex].twitter_caption;
        schedule.generatedTrends[trendIndex].tiktok_caption =
          dynamicPosts.find((p) => p.platform === "tiktok")?.content ||
          schedule.generatedTrends[trendIndex].tiktok_caption;
        schedule.generatedTrends[trendIndex].youtube_caption =
          dynamicPosts.find((p) => p.platform === "youtube")?.content ||
          schedule.generatedTrends[trendIndex].youtube_caption;

        schedule.generatedTrends[trendIndex].enhanced_with_dynamic_posts = true;
        schedule.generatedTrends[trendIndex].caption_status = "ready";
        schedule.generatedTrends[trendIndex].caption_processed_at = new Date();

        // Save after each video to prevent data loss
        await schedule.save();

        console.log(
          `✅ Video ${i + 1}/${
            pendingTrends.length
          } captions generated and saved`
        );

        // Small delay between videos to avoid rate limiting
        if (i < pendingTrends.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(
          `❌ Failed to generate captions for video ${i + 1}:`,
          error
        );
        // Mark as failed but continue with other videos
        schedule.generatedTrends[trendIndex].caption_status = "failed";
        schedule.generatedTrends[trendIndex].caption_error =
          error instanceof Error ? error.message : "Unknown error";
        await schedule.save();
      }
    }

    console.log(
      `🎉 Background caption generation completed for schedule ${scheduleId}`
    );
  }

  /**
   * Get dynamic caption from generated posts
   */
  private getDynamicCaption(dynamicPosts: any[], platform: string): string {
    const post = dynamicPosts.find((p) => p.platform === platform);
    if (post && post.content) {
      return post.content;
    }

    // Fallback caption when dynamic generation fails
    console.warn(`⚠️ No dynamic caption found for ${platform}, using fallback`);
    return `Real Estate Update - Check out the latest market insights!`;
  }
}

export default VideoScheduleService;
