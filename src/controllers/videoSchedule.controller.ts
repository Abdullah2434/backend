import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import VideoScheduleService, {
  ScheduleData,
} from "../services/videoSchedule.service";
import UserVideoSettings from "../models/UserVideoSettings";
import TimezoneService from "../utils/timezone";
import { SubscriptionService } from "../services/subscription.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateCreateSchedule,
  validateScheduleIdParam,
  validateUpdateSchedule,
} from "../validations/videoSchedule.validations";
import {
  getUserIdFromRequest,
  convertDateToUTC,
  formatScheduleResponse,
  formatVideoTrend,
  calculateCompletionRate,
  getUpcomingVideos,
  calculateScheduleStats,
  prepareUpdateData,
  getErrorStatus,
} from "../utils/videoScheduleHelpers";
import { DEFAULT_DURATION } from "../constants/videoSchedule.constants";

// ==================== SERVICE INSTANCE ====================
const videoScheduleService = new VideoScheduleService();

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
    const validationResult = validateCreateSchedule(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { frequency, schedule, startDate, endDate, email: bodyEmail } =
      validationResult.data!;

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
    const upcomingVideos = getUpcomingVideos(schedule, 5);

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
    const scheduleIdValidation = validateScheduleIdParam({ scheduleId });
    if (!scheduleIdValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        scheduleIdValidation.errors
      );
    }

    // Validate request body
    const validationResult = validateUpdateSchedule(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const timezone = TimezoneService.detectTimezone(req);
    const updateData = prepareUpdateData(validationResult.data!, timezone);

    const updatedSchedule = await videoScheduleService.updateSchedule(
      scheduleIdValidation.data!.scheduleId,
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
    const validationResult = validateScheduleIdParam({ scheduleId });
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const success = await videoScheduleService.deactivateSchedule(
      validationResult.data!.scheduleId,
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

    return ResponseHelper.success(
      res,
      "Schedule details retrieved successfully",
      {
        ...scheduleData,
        videos: schedule.generatedTrends.map((trend: any, index: number) =>
          formatVideoTrend(trend, index)
        ),
      }
    );
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

    const stats = calculateScheduleStats(schedule);
    const completionRate = calculateCompletionRate(stats.total, stats.completed);

    return ResponseHelper.success(
      res,
      "Schedule statistics retrieved successfully",
      {
        stats,
        completionRate,
        scheduleInfo: {
          frequency: schedule.frequency,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          isActive: schedule.isActive,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in getScheduleStats:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get schedule statistics",
    });
  }
}
