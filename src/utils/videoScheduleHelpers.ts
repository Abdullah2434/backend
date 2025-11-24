import { AuthenticatedRequest } from "../types";
import TimezoneService from "./timezone";
import { DATE_ONLY_REGEX, VIDEO_STATUSES } from "../constants/videoSchedule.constants";

// ==================== CONTROLLER HELPER FUNCTIONS ====================

/**
 * Get user ID from authenticated request
 */
export function getUserIdFromRequest(req: AuthenticatedRequest): string {
  if (!req.user?._id) {
    throw new Error("User not authenticated");
  }
  return req.user._id.toString();
}

/**
 * Convert date from user's timezone to UTC
 */
export function convertDateToUTC(
  date: string | Date,
  timezone: string,
  isEndDate: boolean = false
): Date {
  if (typeof date === "string") {
    // If date is just a date (YYYY-MM-DD), treat it as start/end of day in user's timezone
    if (date.match(DATE_ONLY_REGEX)) {
      const time = isEndDate ? "23:59:59" : "00:00:00";
      return TimezoneService.ensureUTCDate(`${date} ${time}`, timezone);
    } else {
      // If it includes time, use as is
      return TimezoneService.ensureUTCDate(date, timezone);
    }
  } else {
    return new Date(date);
  }
}

/**
 * Format schedule response data
 */
export function formatScheduleResponse(schedule: any) {
  return {
    scheduleId: schedule._id.toString(),
    frequency: schedule.frequency,
    schedule: schedule.schedule,
    days: schedule.schedule?.days || [],
    times: schedule.schedule?.times || [],
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    isActive: schedule.isActive,
    totalVideos: schedule.generatedTrends?.length || 0,
    completedVideos:
      schedule.generatedTrends?.filter(
        (t: any) => t.status === VIDEO_STATUSES.COMPLETED
      ).length || 0,
    pendingVideos:
      schedule.generatedTrends?.filter(
        (t: any) => t.status === VIDEO_STATUSES.PENDING
      ).length || 0,
    processingVideos:
      schedule.generatedTrends?.filter(
        (t: any) => t.status === VIDEO_STATUSES.PROCESSING
      ).length || 0,
    failedVideos:
      schedule.generatedTrends?.filter(
        (t: any) => t.status === VIDEO_STATUSES.FAILED
      ).length || 0,
  };
}

/**
 * Format video trend data
 */
export function formatVideoTrend(trend: any, index: number) {
  return {
    index,
    description: trend.description,
    keypoints: trend.keypoints,
    scheduledFor: trend.scheduledFor,
    status: trend.status,
    videoId: trend.videoId,
    caption_status: trend.caption_status || "ready",
    enhanced_with_dynamic_posts: trend.enhanced_with_dynamic_posts || false,
    caption_processed_at: trend.caption_processed_at,
    caption_error: trend.caption_error,
    socialCaptions: {
      instagram: trend.instagram_caption,
      facebook: trend.facebook_caption,
      linkedin: trend.linkedin_caption,
      twitter: trend.twitter_caption,
      tiktok: trend.tiktok_caption,
      youtube: trend.youtube_caption,
    },
  };
}

/**
 * Calculate completion rate
 */
export function calculateCompletionRate(
  total: number,
  completed: number
): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100 * 100) / 100;
}

/**
 * Get upcoming videos from schedule
 */
export function getUpcomingVideos(schedule: any, limit: number = 5) {
  return schedule.generatedTrends
    .filter(
      (t: any) =>
        t.status === VIDEO_STATUSES.PENDING &&
        new Date(t.scheduledFor) > new Date()
    )
    .slice(0, limit)
    .map((t: any) => ({
      description: t.description,
      scheduledFor: t.scheduledFor,
      status: t.status,
    }));
}

/**
 * Calculate schedule statistics
 */
export function calculateScheduleStats(schedule: any) {
  const total = schedule.generatedTrends.length;
  const completed = schedule.generatedTrends.filter(
    (t: any) => t.status === VIDEO_STATUSES.COMPLETED
  ).length;
  const pending = schedule.generatedTrends.filter(
    (t: any) => t.status === VIDEO_STATUSES.PENDING
  ).length;
  const processing = schedule.generatedTrends.filter(
    (t: any) => t.status === VIDEO_STATUSES.PROCESSING
  ).length;
  const failed = schedule.generatedTrends.filter(
    (t: any) => t.status === VIDEO_STATUSES.FAILED
  ).length;

  return {
    total,
    completed,
    pending,
    processing,
    failed,
  };
}

/**
 * Prepare update data with date conversions
 */
export function prepareUpdateData(
  rawUpdateData: any,
  timezone: string
): any {
  const updateData: any = { ...rawUpdateData };
  if (updateData.startDate) {
    updateData.startDate = convertDateToUTC(
      updateData.startDate,
      timezone,
      false
    );
  }
  if (updateData.endDate) {
    updateData.endDate = convertDateToUTC(updateData.endDate, timezone, true);
  }
  return updateData;
}

/**
 * Determine HTTP status code based on error message
 */
export function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("token") ||
    message.includes("not authenticated") ||
    message.includes("unauthorized")
  ) {
    return 401;
  }
  if (message.includes("subscription")) {
    return 403;
  }
  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("already exists")) {
    return 409;
  }
  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

