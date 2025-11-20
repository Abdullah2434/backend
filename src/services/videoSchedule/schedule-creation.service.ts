import VideoSchedule, { IVideoSchedule } from "../../models/VideoSchedule";
import UserVideoSettings from "../../models/UserVideoSettings";
import { generateRealEstateTrends } from "../trends.service";
import ScheduleEmailService, {
  ScheduleEmailData,
} from "../scheduleEmail.service";
import { VideoScheduleUtils } from "./utils.service";
import { VideoScheduleCaptionGeneration } from "./caption-generation.service";
import { ScheduleData } from "./types";
import {
  getUserExistingVideoTitles,
  filterExistingTrends,
} from "../../utils/videoHelpers";

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

    // Get user's existing video titles to filter out duplicates
    const existingTitles = await getUserExistingVideoTitles(userId, email);

    const allTrends = [];
    const chunkSize = 5;
    const maxAttempts = 10; // Prevent infinite loops
    let attemptCount = 0;

    while (allTrends.length < numberOfVideos && attemptCount < maxAttempts) {
      const remainingTrends = numberOfVideos - allTrends.length;
      const currentChunkSize = Math.min(chunkSize, remainingTrends);

      try {
        const chunkTrends = await generateRealEstateTrends(
          currentChunkSize * 2, // Generate more to account for filtering
          0,
          attemptCount
        );

        if (!chunkTrends || chunkTrends.length === 0) {
          throw new Error(
            `Failed to generate trends for attempt ${attemptCount + 1}`
          );
        }

        // Filter out trends that already have videos
        const filteredTrends = filterExistingTrends(
          chunkTrends,
          existingTitles
        );

        if (filteredTrends.length === 0) {
          // All trends were filtered out, try again with different seed
          attemptCount++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // Use basic captions for all videos initially
        const basicTrends = filteredTrends
          .slice(0, currentChunkSize)
          .map((trend) => ({
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

        // Update existing titles set with newly added trends to avoid duplicates within schedule
        basicTrends.forEach((trend) => {
          const normalized = trend.description
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ");
          existingTitles.add(normalized);
        });

        attemptCount++;
        // Add a small delay between chunks to avoid rate limiting
        if (allTrends.length < numberOfVideos) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        attemptCount++;
        if (attemptCount >= maxAttempts) {
          throw new Error(
            `Failed to generate enough unique trends after ${maxAttempts} attempts. Please try again.`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // If we still don't have enough trends, use what we have
    if (allTrends.length < numberOfVideos) {
      console.warn(
        `Warning: Only generated ${allTrends.length} unique trends out of ${numberOfVideos} requested for user ${userId}`
      );
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

    // Get user's existing video titles to filter out duplicates
    const existingTitles = await getUserExistingVideoTitles(userId, email);

    const allTrends = [];
    const chunkSize = 5;
    const maxAttempts = 10; // Prevent infinite loops
    let attemptCount = 0;

    while (allTrends.length < numberOfVideos && attemptCount < maxAttempts) {
      const remainingTrends = numberOfVideos - allTrends.length;
      const currentChunkSize = Math.min(chunkSize, remainingTrends);

      try {
        const chunkTrends = await generateRealEstateTrends(
          currentChunkSize * 2, // Generate more to account for filtering
          0,
          attemptCount
        );

        if (!chunkTrends || chunkTrends.length === 0) {
          throw new Error(
            `Failed to generate trends for attempt ${attemptCount + 1}`
          );
        }

        // Filter out trends that already have videos
        const filteredTrends = filterExistingTrends(
          chunkTrends,
          existingTitles
        );

        if (filteredTrends.length === 0) {
          // All trends were filtered out, try again with different seed
          attemptCount++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // Hybrid approach: Generate dynamic captions for first video only
        // Remaining videos will be processed in background
        let enhancedTrends;
        const trendsToUse = filteredTrends.slice(0, currentChunkSize);

        if (allTrends.length === 0) {
          // First chunk - generate dynamic captions
          enhancedTrends =
            await VideoScheduleCaptionGeneration.generateDynamicCaptionsForTrends(
              trendsToUse,
              userSettings,
              userId
            );
        } else {
          // Subsequent chunks - use basic captions
          enhancedTrends = trendsToUse.map((trend) => ({
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

        // Update existing titles set with newly added trends to avoid duplicates within schedule
        trendsToUse.forEach((trend) => {
          const normalized = trend.description
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ");
          existingTitles.add(normalized);
        });

        attemptCount++;
        // Add a small delay between chunks to avoid rate limiting
        if (allTrends.length < numberOfVideos) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        attemptCount++;
        if (attemptCount >= maxAttempts) {
          throw new Error(
            `Failed to generate enough unique trends after ${maxAttempts} attempts. Please try again.`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // If we still don't have enough trends, use what we have
    if (allTrends.length < numberOfVideos) {
      console.warn(
        `Warning: Only generated ${allTrends.length} unique trends out of ${numberOfVideos} requested for user ${userId}`
      );
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
