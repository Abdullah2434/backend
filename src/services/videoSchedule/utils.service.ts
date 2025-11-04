import { ScheduleData } from "./types";
import TimezoneService from "../../utils/timezone";

export class VideoScheduleUtils {
  /**
   * Validate schedule data
   */
  static validateScheduleData(scheduleData: ScheduleData): void {
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
  static calculateNumberOfVideos(
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
  static createImmediateScheduledPosts(
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
  static shouldSkipScheduledDay(
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
   * Helper method to calculate days until target day
   */
  static getDaysUntilTargetDay(
    currentDay: string,
    targetDay: string
  ): number {
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
}

