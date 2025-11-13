import VideoSchedule, { IVideoSchedule } from "../../models/VideoSchedule";
import UserVideoSettings from "../../models/UserVideoSettings";
import { generateRealEstateTrends } from "../trends.service";
import ScheduleEmailService, {
  ScheduleEmailData,
} from "../scheduleEmail.service";
import { VideoScheduleUtils } from "./utils.service";
import { VideoScheduleCaptionGeneration } from "./caption-generation.service";
import { ScheduleData } from "./types";

export class VideoScheduleCreation {
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
    VideoScheduleUtils.validateScheduleData(scheduleData);

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


    // Calculate number of videos needed for one month
    const numberOfVideos = VideoScheduleUtils.calculateNumberOfVideos(
      scheduleData.frequency,
      startDate,
      endDate
    );

    

    const allTrends = [];
    const chunkSize = 5;
    const totalChunks = Math.ceil(numberOfVideos / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const remainingTrends = numberOfVideos - allTrends.length;
      const currentChunkSize = Math.min(chunkSize, remainingTrends);

    

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
    

        // Add a small delay between chunks to avoid rate limiting
        if (i < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
     
        throw new Error(
          `Failed to generate trends in chunk ${i + 1}. Please try again.`
        );
      }
    }

    // Create scheduled trends
    const generatedTrends = VideoScheduleUtils.createScheduledTrends(
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
    const { notificationService } = await import("../notification.service");
    notificationService.notifyScheduleStatus(userId, "processing", {
      scheduleId: schedule._id.toString(),
      message: "Schedule creation started",
      totalVideos: numberOfVideos,
      processedVideos: 0,
    });

    // Queue background job to generate dynamic captions for ALL videos
    VideoScheduleCaptionGeneration.queueBackgroundCaptionGenerationAsync(
      schedule._id.toString(),
      userId,
      userSettings,
      numberOfVideos
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
    VideoScheduleUtils.validateScheduleData(scheduleData);

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


    // Calculate number of videos needed for one month
    const numberOfVideos = VideoScheduleUtils.calculateNumberOfVideos(
      scheduleData.frequency,
      startDate,
      endDate
    );

    const allTrends = [];
    const chunkSize = 5;
    const totalChunks = Math.ceil(numberOfVideos / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const remainingTrends = numberOfVideos - allTrends.length;
      const currentChunkSize = Math.min(chunkSize, remainingTrends);
      try {
        const chunkTrends = await generateRealEstateTrends(
          currentChunkSize,
          0,
          i
        );

        if (!chunkTrends || chunkTrends.length === 0) {
          throw new Error(`Failed to generate trends for chunk ${i + 1}`);
        }

       
        // Hybrid approach: Generate dynamic captions for first video only
        // Remaining videos will be processed in background
        let enhancedTrends;
        if (i === 0) {
    
          enhancedTrends =
            await VideoScheduleCaptionGeneration.generateDynamicCaptionsForTrends(
              chunkTrends,
              userSettings,
              userId
            );
       
        } else {
       
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
   
        // Add a small delay between chunks to avoid rate limiting
        if (i < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
  
        throw new Error(
          `Failed to generate trends in chunk ${i + 1}. Please try again.`
        );
      }
    }


    // Create scheduled trends
    const generatedTrends = VideoScheduleUtils.createScheduledTrends(
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
    VideoScheduleCaptionGeneration.queueBackgroundCaptionGeneration(
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

      // Don't fail the schedule creation if email fails
    }



    return schedule;
  }
}

