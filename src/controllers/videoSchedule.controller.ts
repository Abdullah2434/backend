import { Request, Response } from "express";
import VideoScheduleService, {
  ScheduleData,
} from "../services/videoSchedule.service";
import UserVideoSettings from "../models/UserVideoSettings";
import { AuthService } from "../modules/auth/services/auth.service";
import TimezoneService from "../utils/timezone";

const videoScheduleService = new VideoScheduleService();
const authService = new AuthService();

function requireAuth(req: Request) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) {
    throw new Error("Access token is required");
  }

  try {
    // Verify JWT token and extract user information
    const payload = authService.verifyToken(token);

    if (!payload || !payload.userId) {
      throw new Error("Invalid token: missing user information");
    }

    // Validate that userId is a valid ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(payload.userId)) {
      throw new Error("Invalid user ID format in token");
    }

    return { userId: payload.userId };
  } catch (error: any) {
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token format");
    } else if (error.name === "TokenExpiredError") {
      throw new Error("Token has expired");
    } else {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
}

/**
 * Create a new video schedule
 */
export async function createSchedule(req: Request, res: Response) {
  try {
    console.log("📝 Creating video schedule...");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const payload = requireAuth(req);
    const { frequency, schedule, startDate, endDate } = req.body;

    // Detect timezone from request
    const timezone = TimezoneService.detectTimezone(req);
    console.log("🌍 Detected timezone:", timezone);

    // Validate required fields (endDate is optional - will be set to one month from startDate)
    if (!frequency || !schedule || !startDate) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: frequency, schedule, startDate (endDate is optional - will be set to one month from startDate)",
      });
    }

    // Convert schedule objects to arrays if needed
    let processedSchedule = schedule;
    if (
      schedule.days &&
      typeof schedule.days === "object" &&
      !Array.isArray(schedule.days)
    ) {
      processedSchedule.days = Object.values(schedule.days);
    }
    if (
      schedule.times &&
      typeof schedule.times === "object" &&
      !Array.isArray(schedule.times)
    ) {
      processedSchedule.times = Object.values(schedule.times);
    }

    // Normalize day names (capitalize first letter, lowercase rest)
    if (processedSchedule.days && Array.isArray(processedSchedule.days)) {
      processedSchedule.days = processedSchedule.days.map((day: string) => {
        const trimmed = day.trim();
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      });
    }

    // Validate day names
    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    if (processedSchedule.days && Array.isArray(processedSchedule.days)) {
      const invalidDays = processedSchedule.days.filter(
        (day: string) => !validDays.includes(day)
      );
      if (invalidDays.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid day names: ${invalidDays.join(
            ", "
          )}. Valid days are: ${validDays.join(", ")}`,
        });
      }
    }

    // Keep original times - they will be converted to UTC in the service
    // when combined with specific dates
    if (processedSchedule.times && Array.isArray(processedSchedule.times)) {
      console.log(
        "🕐 Keeping original times for timezone conversion in service:",
        processedSchedule.times
      );
      console.log("🌍 User timezone:", timezone);
    }

    console.log("Processed schedule:", processedSchedule);

    // Validate frequency
    const validFrequencies = ["once_week", "twice_week", "three_week", "daily"];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid frequency. Must be one of: once_week, twice_week, three_week, daily",
      });
    }

    // Get user email from request or user settings
    let email = req.body.email;
    if (!email) {
      const userSettings = await UserVideoSettings.findOne({
        userId: payload.userId,
      });
      if (!userSettings) {
        return res.status(404).json({
          success: false,
          message:
            "User video settings not found. Please complete your profile first.",
        });
      }
      email = userSettings.email;
    }

    // Convert startDate from user's timezone to UTC (avoid double conversion if already UTC/ISO with zone)
    let startDateUTC: Date;
    if (typeof startDate === "string") {
      // If startDate is just a date (YYYY-MM-DD), treat it as start of day in user's timezone
      if (startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        startDateUTC = TimezoneService.ensureUTCDate(
          `${startDate} 00:00:00`,
          timezone
        );
      } else {
        // If it includes time, use as is
        startDateUTC = TimezoneService.ensureUTCDate(startDate, timezone);
      }
    } else {
      startDateUTC = new Date(startDate);
    }

    // Convert endDate from user's timezone to UTC if provided (avoid double conversion)
    let endDateUTC: Date;
    if (endDate) {
      if (typeof endDate === "string") {
        // If endDate is just a date (YYYY-MM-DD), treat it as end of day in user's timezone
        if (endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          endDateUTC = TimezoneService.ensureUTCDate(
            `${endDate} 23:59:59`,
            timezone
          );
        } else {
          // If it includes time, use as is
          endDateUTC = TimezoneService.ensureUTCDate(endDate, timezone);
        }
      } else {
        endDateUTC = new Date(endDate);
      }
    } else {
      endDateUTC = new Date(); // Will be overridden to one month
    }

    console.log(
      `🕐 Start date conversion: ${startDate} (${timezone}) → ${startDateUTC.toISOString()} (UTC)`
    );
    if (endDate) {
      console.log(
        `🕐 End date conversion: ${endDate} (${timezone}) → ${endDateUTC.toISOString()} (UTC)`
      );
    }

    const scheduleData: ScheduleData = {
      frequency,
      schedule: processedSchedule,
      startDate: startDateUTC,
      endDate: endDateUTC, // Will be overridden to one month
      timezone, // Include timezone information
    };

    const createdSchedule = await videoScheduleService.createSchedule(
      payload.userId,
      email,
      scheduleData
    );

    return res.status(201).json({
      success: true,
      message: "Video schedule created successfully for one month duration",
      data: {
        scheduleId: createdSchedule._id,
        frequency: createdSchedule.frequency,
        schedule: createdSchedule.schedule,
        startDate: createdSchedule.startDate,
        endDate: createdSchedule.endDate,
        duration: "1 month",
        totalVideos: createdSchedule.generatedTrends.length,
        isActive: createdSchedule.isActive,
      },
    });
  } catch (e: any) {
    console.error("❌ Error creating schedule:", e);
    console.error("Error details:", {
      message: e.message,
      stack: e.stack,
      name: e.name,
    });

    // Return appropriate status code based on error type
    const statusCode = e.message.includes("Access token")
      ? 401
      : e.message.includes("User ID")
      ? 401
      : e.message.includes("not found")
      ? 404
      : e.message.includes("already exists")
      ? 409
      : 400;

    return res.status(statusCode).json({
      success: false,
      message: e.message || "Failed to create video schedule",
      error: process.env.NODE_ENV === "development" ? e.stack : undefined,
    });
  }
}

/**
 * Get user's active schedule
 */
export async function getSchedule(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const schedule = await videoScheduleService.getUserSchedule(payload.userId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "No active schedule found",
      });
    }

    return res.json({
      success: true,
      data: {
        scheduleId: schedule._id,
        frequency: schedule.frequency,
        schedule: schedule.schedule,
        days: schedule.schedule.days, // Add days field
        times: schedule.schedule.times, // Add times field
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        isActive: schedule.isActive,
        totalVideos: schedule.generatedTrends.length,
        completedVideos: schedule.generatedTrends.filter(
          (t) => t.status === "completed"
        ).length,
        pendingVideos: schedule.generatedTrends.filter(
          (t) => t.status === "pending"
        ).length,
        processingVideos: schedule.generatedTrends.filter(
          (t) => t.status === "processing"
        ).length,
        failedVideos: schedule.generatedTrends.filter(
          (t) => t.status === "failed"
        ).length,
        upcomingVideos: schedule.generatedTrends
          .filter(
            (t) =>
              t.status === "pending" && new Date(t.scheduledFor) > new Date()
          )
          .slice(0, 5)
          .map((t) => ({
            description: t.description,
            scheduledFor: t.scheduledFor,
            status: t.status,
          })),
      },
    });
  } catch (e: any) {
    console.error("Error getting schedule:", e);
    return res.status(500).json({
      success: false,
      message: e.message || "Failed to get video schedule",
    });
  }
}

/**
 * Update schedule
 */
export async function updateSchedule(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { scheduleId } = req.params;
    const updateData = req.body;

    const updatedSchedule = await videoScheduleService.updateSchedule(
      scheduleId,
      payload.userId,
      updateData
    );

    if (!updatedSchedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    return res.json({
      success: true,
      message: "Schedule updated successfully",
      data: {
        scheduleId: updatedSchedule._id,
        frequency: updatedSchedule.frequency,
        schedule: updatedSchedule.schedule,
        startDate: updatedSchedule.startDate,
        endDate: updatedSchedule.endDate,
        isActive: updatedSchedule.isActive,
      },
    });
  } catch (e: any) {
    console.error("Error updating schedule:", e);
    return res.status(400).json({
      success: false,
      message: e.message || "Failed to update video schedule",
    });
  }
}

/**
 * Deactivate schedule
 */
export async function deactivateSchedule(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { scheduleId } = req.params;

    const success = await videoScheduleService.deactivateSchedule(
      scheduleId,
      payload.userId
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found",
      });
    }

    return res.json({
      success: true,
      message: "Schedule deactivated successfully",
    });
  } catch (e: any) {
    console.error("Error deactivating schedule:", e);
    return res.status(500).json({
      success: false,
      message: e.message || "Failed to deactivate video schedule",
    });
  }
}

/**
 * Get schedule details with all videos
 */
export async function getScheduleDetails(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const schedule = await videoScheduleService.getUserSchedule(payload.userId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "No active schedule found",
      });
    }

    return res.json({
      success: true,
      data: {
        scheduleId: schedule._id,
        frequency: schedule.frequency,
        schedule: schedule.schedule,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        isActive: schedule.isActive,
        videos: schedule.generatedTrends.map((trend, index) => ({
          index,
          description: trend.description,
          keypoints: trend.keypoints,
          scheduledFor: trend.scheduledFor,
          status: trend.status,
          videoId: trend.videoId,
          caption_status: trend.caption_status || "ready", // Show caption processing status
          enhanced_with_dynamic_posts:
            trend.enhanced_with_dynamic_posts || false,
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
        })),
      },
    });
  } catch (e: any) {
    console.error("Error getting schedule details:", e);
    return res.status(500).json({
      success: false,
      message: e.message || "Failed to get schedule details",
    });
  }
}

/**
 * Get schedule statistics
 */
export async function getScheduleStats(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const schedule = await videoScheduleService.getUserSchedule(payload.userId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "No active schedule found",
      });
    }

    const stats = {
      total: schedule.generatedTrends.length,
      completed: schedule.generatedTrends.filter(
        (t) => t.status === "completed"
      ).length,
      pending: schedule.generatedTrends.filter((t) => t.status === "pending")
        .length,
      processing: schedule.generatedTrends.filter(
        (t) => t.status === "processing"
      ).length,
      failed: schedule.generatedTrends.filter((t) => t.status === "failed")
        .length,
    };

    const completionRate =
      stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

    return res.json({
      success: true,
      data: {
        stats,
        completionRate: Math.round(completionRate * 100) / 100,
        scheduleInfo: {
          frequency: schedule.frequency,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          isActive: schedule.isActive,
        },
      },
    });
  } catch (e: any) {
    console.error("Error getting schedule stats:", e);
    return res.status(500).json({
      success: false,
      message: e.message || "Failed to get schedule statistics",
    });
  }
}
