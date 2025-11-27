import { ScheduleData } from "./types";
import TimezoneService from "../../utils/timezone";
import {
  FREQUENCY_ONCE_WEEK,
  FREQUENCY_TWICE_WEEK,
  FREQUENCY_THREE_WEEK,
  FREQUENCY_DAILY,
  VALID_DAYS,
  TIME_FORMAT_REGEX,
  ERROR_MESSAGES,
  MIN_SCHEDULE_BUFFER_MS,
} from "../../constants/videoScheduleService.constants";

export class VideoScheduleUtils {
  /**
   * Validate schedule data
   */
  static validateScheduleData(scheduleData: ScheduleData): void {
    const { frequency, schedule } = scheduleData;

    // Validate frequency-specific requirements
    switch (frequency) {
      case FREQUENCY_ONCE_WEEK:
        if (schedule.days.length !== 1 || schedule.times.length !== 1) {
          throw new Error(ERROR_MESSAGES.ONCE_WEEK_REQUIREMENTS);
        }
        break;
      case FREQUENCY_TWICE_WEEK:
        if (schedule.days.length !== 2 || schedule.times.length !== 2) {
          throw new Error(ERROR_MESSAGES.TWICE_WEEK_REQUIREMENTS);
        }
        break;
      case FREQUENCY_THREE_WEEK:
        if (schedule.days.length !== 3 || schedule.times.length !== 3) {
          throw new Error(ERROR_MESSAGES.THREE_WEEK_REQUIREMENTS);
        }
        break;
      case FREQUENCY_DAILY:
        if (schedule.days.length !== 0 || schedule.times.length !== 1) {
          throw new Error(ERROR_MESSAGES.DAILY_REQUIREMENTS);
        }
        break;
    }

    // Validate time format
    schedule.times.forEach((time) => {
      if (!TIME_FORMAT_REGEX.test(time)) {
        throw new Error(`${ERROR_MESSAGES.INVALID_TIME_FORMAT}: ${time}. Use HH:MM format.`);
      }
    });

    // Validate days
    schedule.days.forEach((day) => {
      if (!VALID_DAYS.includes(day as any)) {
        throw new Error(`${ERROR_MESSAGES.INVALID_DAY}: ${day}`);
      }
    });
  }

  /**
   * Calculate number of videos needed based on frequency and duration
   * Ensures we calculate for the full month period
   */
  static calculateNumberOfVideos(
    frequency: string,
    startDate: Date,
    endDate: Date
  ): number {
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weeks = Math.ceil(daysDiff / 7);

    let numberOfVideos = 0;

    switch (frequency) {
      case FREQUENCY_ONCE_WEEK:
        numberOfVideos = weeks;
        break;
      case FREQUENCY_TWICE_WEEK:
        numberOfVideos = weeks * 2;
        break;
      case FREQUENCY_THREE_WEEK:
        numberOfVideos = weeks * 3;
        break;
      case FREQUENCY_DAILY:
        numberOfVideos = daysDiff;
        break;
      default:
        numberOfVideos = 1;
    }

    return numberOfVideos;
  }

  /**
   * Create scheduled trends with proper timing
   * Handles edge case: if scheduled time is less than 40 minutes away, skip that day
   */
  static createScheduledTrends(
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

  

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.toLocaleDateString("en-US", {
        weekday: "long",
      });

      // Check if this day should have a video
      let shouldSchedule = false;
      let timeIndex = 0;

      if (frequency === FREQUENCY_DAILY) {
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


        // Edge case handling: Check if scheduled time is less than minimum buffer away
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
          throw new Error(
            `${ERROR_MESSAGES.TREND_MISSING_FIELDS} at index ${trendIndex}`
          );
        }

        scheduledTrends.push({
          ...trendToUse,
          scheduledFor: finalScheduledTime, // Use UTC time
          status: "pending" as const,
        });

        trendIndex++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return scheduledTrends;
  }

  /**
   * Create immediate scheduled posts for frequency updates
   * Only creates posts for the next few upcoming schedule slots
   */
  static createImmediateScheduledPosts(
    trends: any[],
    scheduleData: ScheduleData,
    startDate: Date
  ): any[] {
    const scheduledTrends = [];
    const { frequency, schedule } = scheduleData;
    let trendIndex = 0;
    const now = new Date();


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

      if (frequency === FREQUENCY_DAILY) {
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
        if (timeDiff < MIN_SCHEDULE_BUFFER_MS) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const trendToUse = trends[trendIndex];
        if (!trendToUse) {
      
          break;
        }

        scheduledTrends.push({
          ...trendToUse,
          scheduledFor: finalScheduledTime,
          status: "pending" as const,
        });

        trendIndex++;
        postsCreated++;
  
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }


    return scheduledTrends;
  }

  /**
   * Check if a scheduled day should be skipped based on edge case rules
   * Skips if scheduled time is less than 40 minutes away from current time
   */
  static shouldSkipScheduledDay(
    scheduledTime: Date,
    currentTime: Date,
    dayOfWeek: string,
    scheduledTimeString: string
  ): boolean {
    const timeDiff = scheduledTime.getTime() - currentTime.getTime();

    // Edge case: If scheduled time is less than minimum buffer away, skip this day
    if (timeDiff < MIN_SCHEDULE_BUFFER_MS) {
      return true;
    }

    return false;
  }

  /**
   * Helper method to calculate days until target day
   */
  static getDaysUntilTargetDay(currentDay: string, targetDay: string): number {
    const daysOfWeek = [
      "Sunday",
      ...VALID_DAYS,
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
}
