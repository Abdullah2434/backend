import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import VideoScheduleService, {
  ScheduleData,
} from "../services/videoSchedule";
import UserVideoSettings from "../models/UserVideoSettings";
import TimezoneService from "../utils/timezone";
import { SubscriptionService } from "../services/payment";
import { ResponseHelper } from "../utils/responseHelper";
import {
  createScheduleSchema,
  scheduleIdParamSchema,
  updateScheduleSchema,
} from "../validations/videoSchedule.validations";

// ==================== CONSTANTS ====================
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_DURATION = "1 month";

// Video statuses
const VIDEO_STATUSES = {
  COMPLETED: "completed",
  PENDING: "pending",
  PROCESSING: "processing",
  FAILED: "failed",
} as const;

// ==================== SERVICE INSTANCE ====================
const videoScheduleService = new VideoScheduleService();

// ==================== HELPER FUNCTIONS ====================
/**
 * Get user ID from authenticated request
 */
function getUserIdFromRequest(req: AuthenticatedRequest): string {
  if (!req.user?._id) {
    throw new Error("User not authenticated");
  }
  return req.user._id.toString();
}

/**
 * Convert date from user's timezone to UTC
 */
function convertDateToUTC(
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
function formatScheduleResponse(schedule: any) {
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
function formatVideoTrend(trend: any, index: number) {
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
function calculateCompletionRate(
  total: number,
  completed: number
): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100 * 100) / 100;
}

/**
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
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

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Create a new video schedule
 * POST /api/video-schedule
 */
export async function createSchedule(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const timezone = TimezoneService.detectTimezone(req);

    // Validate request body
    const validationResult = createScheduleSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { frequency, schedule, startDate, endDate, email: bodyEmail } =
      validationResult.data;

    // Check for active subscription
    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getActiveSubscription(userId);
    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required to create video schedules",
      });
    }

    // Get user email from request or user settings
    let email: string = bodyEmail || "";
    if (!email) {
      const userSettings = await UserVideoSettings.findOne({ userId });
      if (!userSettings) {
        return ResponseHelper.notFound(
          res,
          "User video settings not found. Please complete your profile first."
        );
      }
      email = userSettings.email;
    }

    if (!email) {
      return ResponseHelper.badRequest(
        res,
        "Email is required. Please provide email in request or complete your profile."
      );
    }

    // Convert dates from user's timezone to UTC
    const startDateUTC = convertDateToUTC(startDate, timezone, false);
    const endDateUTC = endDate
      ? convertDateToUTC(endDate, timezone, true)
      : new Date(); // Will be overridden to one month

    const scheduleData: ScheduleData = {
      frequency,
      schedule,
      startDate: startDateUTC,
      endDate: endDateUTC,
      timezone,
    };

    const createdSchedule = await videoScheduleService.createScheduleAsync(
      userId,
      email,
      scheduleData
    );

    return ResponseHelper.created(
      res,
      "Video schedule creation started successfully",
      {
        scheduleId: createdSchedule._id.toString(),
        status: "processing",
        frequency: createdSchedule.frequency,
        schedule: createdSchedule.schedule,
        startDate: createdSchedule.startDate,
        endDate: createdSchedule.endDate,
        duration: DEFAULT_DURATION,
        totalVideos: createdSchedule.generatedTrends.length,
        isActive: createdSchedule.isActive,
        message:
          "Your schedule is being created in the background. You'll receive a notification when it's ready!",
      }
    );
  } catch (error: any) {
    console.error("Error in createSchedule:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to create video schedule",
      error:
        process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

/**
 * Get user's active schedule
 * GET /api/video-schedule
 */
export async function getSchedule(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = getUserIdFromRequest(req);
    const schedule = await videoScheduleService.getUserSchedule(userId);

    if (!schedule) {
      return ResponseHelper.notFound(res, "No active schedule found");
    }

    const scheduleData = formatScheduleResponse(schedule);

    // Get upcoming videos
    const upcomingVideos = schedule.generatedTrends
      .filter(
        (t: any) =>
          t.status === VIDEO_STATUSES.PENDING &&
          new Date(t.scheduledFor) > new Date()
      )
      .slice(0, 5)
      .map((t: any) => ({
        description: t.description,
        scheduledFor: t.scheduledFor,
        status: t.status,
      }));

    return ResponseHelper.success(res, "Schedule retrieved successfully", {
      ...scheduleData,
      upcomingVideos,
    });
  } catch (error: any) {
    console.error("Error in getSchedule:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get video schedule",
    });
  }
}

/**
 * Update schedule
 * PUT /api/video-schedule/:scheduleId
 */
export async function updateSchedule(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { scheduleId } = req.params;

    // Validate scheduleId parameter
    const scheduleIdValidation = scheduleIdParamSchema.safeParse({
      scheduleId,
    });
    if (!scheduleIdValidation.success) {
      const errors = scheduleIdValidation.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    // Validate request body
    const validationResult = updateScheduleSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const rawUpdateData = validationResult.data;
    const timezone = TimezoneService.detectTimezone(req);

    // Convert date strings to Date objects if provided
    const updateData: any = { ...rawUpdateData };
    if (updateData.startDate) {
      updateData.startDate = convertDateToUTC(updateData.startDate, timezone, false);
    }
    if (updateData.endDate) {
      updateData.endDate = convertDateToUTC(updateData.endDate, timezone, true);
    }

    const updatedSchedule = await videoScheduleService.updateSchedule(
      scheduleId,
      userId,
      updateData
    );

    if (!updatedSchedule) {
      return ResponseHelper.notFound(res, "Schedule not found");
    }

    return ResponseHelper.success(res, "Schedule updated successfully", {
      scheduleId: updatedSchedule._id.toString(),
      frequency: updatedSchedule.frequency,
      schedule: updatedSchedule.schedule,
      startDate: updatedSchedule.startDate,
      endDate: updatedSchedule.endDate,
      isActive: updatedSchedule.isActive,
    });
  } catch (error: any) {
    console.error("Error in updateSchedule:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update video schedule",
    });
  }
}

/**
 * Deactivate schedule
 * PUT /api/video-schedule/:scheduleId/deactivate
 */
export async function deactivateSchedule(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { scheduleId } = req.params;

    // Validate scheduleId parameter
    const validationResult = scheduleIdParamSchema.safeParse({ scheduleId });
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const success = await videoScheduleService.deactivateSchedule(
      scheduleId,
      userId
    );

    if (!success) {
      return ResponseHelper.notFound(res, "Schedule not found");
    }

    return ResponseHelper.success(res, "Schedule deactivated successfully");
  } catch (error: any) {
    console.error("Error in deactivateSchedule:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to deactivate video schedule",
    });
  }
}

/**
 * Get schedule details with all videos
 * GET /api/video-schedule/details
 */
export async function getScheduleDetails(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const schedule = await videoScheduleService.getUserSchedule(userId);

    if (!schedule) {
      return ResponseHelper.notFound(res, "No active schedule found");
    }

    const scheduleData = formatScheduleResponse(schedule);

    return ResponseHelper.success(res, "Schedule details retrieved successfully", {
      ...scheduleData,
      videos: schedule.generatedTrends.map((trend: any, index: number) =>
        formatVideoTrend(trend, index)
      ),
    });
  } catch (error: any) {
    console.error("Error in getScheduleDetails:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get schedule details",
    });
  }
}

/**
 * Get schedule statistics
 * GET /api/video-schedule/stats
 */
export async function getScheduleStats(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const schedule = await videoScheduleService.getUserSchedule(userId);

    if (!schedule) {
      return ResponseHelper.notFound(res, "No active schedule found");
    }

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

    const stats = {
      total,
      completed,
      pending,
      processing,
      failed,
    };

    const completionRate = calculateCompletionRate(total, completed);

    return ResponseHelper.success(res, "Schedule statistics retrieved successfully", {
      stats,
      completionRate,
      scheduleInfo: {
        frequency: schedule.frequency,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        isActive: schedule.isActive,
      },
    });
  } catch (error: any) {
    console.error("Error in getScheduleStats:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get schedule statistics",
    });
  }
}
