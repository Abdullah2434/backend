import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types";
import VideoScheduleService from "../services/videoSchedule.service";
import TimezoneService from "../utils/timezone";
import { ResponseHelper } from "../utils/responseHelper";
import {
  editSchedulePostSchema,
  schedulePostIdSchema,
  scheduleIdSchema,
} from "../validations/schedule.validations";

// ==================== CONSTANTS ====================
const POST_ID_SEPARATOR = "_";
const POST_STATUSES = ["pending", "completed", "processing", "failed"] as const;

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
  return req.user._id;
}

/**
 * Parse post ID to extract schedule ID and index
 */
function parsePostId(postId: string): { scheduleId: string; index: number } {
  if (!postId.includes(POST_ID_SEPARATOR)) {
    throw new Error(
      "Invalid post ID format. Expected format: scheduleId_index"
    );
  }

  const parts = postId.split(POST_ID_SEPARATOR);
  const index = parseInt(parts[1]);

  if (isNaN(index)) {
    throw new Error("Invalid post index in post ID");
  }

  return {
    scheduleId: parts[0],
    index,
  };
}

/**
 * Format post data for response
 */
function formatPostData(
  post: any,
  postId: string,
  timezone: string,
  includeVideoId: boolean = false
) {
  return {
    id: postId,
    description: post.description,
    keypoints: post.keypoints,
    scheduledFor: post.scheduledFor,
    status: post.status,
    scheduledForLocal: TimezoneService.convertFromUTC(
      post.scheduledFor,
      timezone
    ),
    captions: {
      instagram: post.instagram_caption,
      facebook: post.facebook_caption,
      linkedin: post.linkedin_caption,
      twitter: post.twitter_caption,
      tiktok: post.tiktok_caption,
      youtube: post.youtube_caption,
    },
    ...(includeVideoId && { videoId: post.videoId }),
  };
}

/**
 * Format schedule info for response
 */
function formatScheduleInfo(schedule: any) {
  return {
    frequency: schedule.frequency,
    days: schedule.schedule?.days || [],
    times: schedule.schedule?.times || [],
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    isActive: schedule.isActive,
    status: schedule.status,
    totalVideos: schedule.generatedTrends?.length || 0,
    pendingVideos:
      schedule.generatedTrends?.filter((t: any) => t.status === "pending")
        .length || 0,
    completedVideos:
      schedule.generatedTrends?.filter((t: any) => t.status === "completed")
        .length || 0,
    processingVideos:
      schedule.generatedTrends?.filter((t: any) => t.status === "processing")
        .length || 0,
    failedVideos:
      schedule.generatedTrends?.filter((t: any) => t.status === "failed")
        .length || 0,
  };
}

/**
 * Convert scheduledFor to UTC with timezone handling
 */
function convertScheduledForToUTC(
  scheduledFor: string | Date,
  timezone: string
): Date {
  if (typeof scheduledFor === "string") {
    return TimezoneService.ensureUTCDate(scheduledFor, timezone);
  } else if (scheduledFor instanceof Date) {
    const dateString = scheduledFor
      .toISOString()
      .replace("T", " ")
      .replace("Z", "")
      .split(".")[0];
    return TimezoneService.ensureUTCDate(dateString, timezone);
  }
  throw new Error("Invalid scheduledFor format");
}

/**
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes("token") || message.includes("not authenticated")) {
    return 401;
  }
  if (message.includes("not found")) {
    return 404;
  }
  if (
    message.includes("invalid") ||
    message.includes("out of range") ||
    message.includes("can only")
  ) {
    return 400;
  }
  return 500;
}

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Get all pending schedule posts
 */
export async function getPendingSchedulePosts(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const timezone = TimezoneService.detectTimezone(req);

    // Get user's active schedule
    const schedule = await videoScheduleService.getUserSchedule(userId);

    if (!schedule) {
      return ResponseHelper.notFound(res, "No active schedule found");
    }

    // Format all posts
    const allPosts = schedule.generatedTrends
      .map((trend: any, index: number) => ({
        id: `${schedule._id}_${index}`,
        index,
        scheduleId: schedule._id.toString(),
        description: trend.description,
        keypoints: trend.keypoints,
        scheduledFor: trend.scheduledFor,
        status: trend.status,
        captions: {
          instagram: trend.instagram_caption,
          facebook: trend.facebook_caption,
          linkedin: trend.linkedin_caption,
          twitter: trend.twitter_caption,
          tiktok: trend.tiktok_caption,
          youtube: trend.youtube_caption,
        },
        scheduledForLocal: TimezoneService.convertFromUTC(
          trend.scheduledFor,
          timezone
        ),
        videoId: trend.videoId,
      }))
      .sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime()
      );

    // Separate posts by status
    const pendingPosts = allPosts.filter((post) => post.status === "pending");
    const completedPosts = allPosts.filter(
      (post) => post.status === "completed"
    );
    const processingPosts = allPosts.filter(
      (post) => post.status === "processing"
    );
    const failedPosts = allPosts.filter((post) => post.status === "failed");

    return ResponseHelper.success(
      res,
      "Schedule posts retrieved successfully",
      {
        id: schedule._id.toString(),
        status: schedule.status,
        timezone,
        totalPosts: allPosts.length,
        totalPendingPosts: pendingPosts.length,
        totalCompletedPosts: completedPosts.length,
        totalProcessingPosts: processingPosts.length,
        totalFailedPosts: failedPosts.length,
        allPosts,
        pendingPosts,
        completedPosts,
        processingPosts,
        failedPosts,
        scheduleInfo: {
          frequency: schedule.frequency,
          days: schedule.schedule?.days || [],
          times: schedule.schedule?.times || [],
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          isActive: schedule.isActive,
          status: schedule.status,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in getPendingSchedulePosts:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get pending schedule posts",
    });
  }
}

/**
 * Edit a schedule post
 */
export async function editSchedulePost(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { scheduleId, postId } = req.params;
    const timezone = TimezoneService.detectTimezone(req);

    // Validate postId format
    const postIdValidation = schedulePostIdSchema.safeParse({ postId });
    if (!postIdValidation.success) {
      const errors = postIdValidation.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    // Validate request body
    const validationResult = editSchedulePostSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { description, keypoints, scheduledFor, captions } =
      validationResult.data;

    // Prepare update data
    const updateData: any = {};
    if (description !== undefined) updateData.description = description;
    if (keypoints !== undefined) updateData.keypoints = keypoints;

    // Convert scheduledFor to UTC if provided
    if (scheduledFor !== undefined) {
      try {
        const scheduledForUTC = convertScheduledForToUTC(
          scheduledFor,
          timezone
        );
        if (isNaN(scheduledForUTC.getTime())) {
          return ResponseHelper.badRequest(
            res,
            "Invalid scheduledFor date format"
          );
        }
        updateData.scheduledFor = scheduledForUTC;
      } catch (error: any) {
        return ResponseHelper.badRequest(
          res,
          "Invalid scheduledFor date format or timezone conversion failed"
        );
      }
    }

    // Handle captions object
    if (captions !== undefined) {
      if (captions.instagram !== undefined)
        updateData.instagram_caption = captions.instagram;
      if (captions.facebook !== undefined)
        updateData.facebook_caption = captions.facebook;
      if (captions.linkedin !== undefined)
        updateData.linkedin_caption = captions.linkedin;
      if (captions.twitter !== undefined)
        updateData.twitter_caption = captions.twitter;
      if (captions.tiktok !== undefined)
        updateData.tiktok_caption = captions.tiktok;
      if (captions.youtube !== undefined)
        updateData.youtube_caption = captions.youtube;
    }

    // Update the post
    const updatedSchedule = await videoScheduleService.updateSchedulePostById(
      scheduleId,
      postId,
      userId,
      updateData
    );

    if (!updatedSchedule) {
      return ResponseHelper.notFound(res, "Schedule not found or not active");
    }

    // Parse post ID to get index
    const { index } = parsePostId(postId);
    const updatedPost = updatedSchedule.generatedTrends[index];

    return ResponseHelper.success(res, "Post updated successfully", {
      scheduleId: updatedSchedule._id.toString(),
      postId,
      postIndex: index,
      timezone,
      updatedPost: formatPostData(updatedPost, postId, timezone),
    });
  } catch (error: any) {
    console.error("Error in editSchedulePost:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to edit schedule post",
    });
  }
}

/**
 * Delete a schedule post
 */
export async function deleteSchedulePost(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { scheduleId, postId } = req.params;

    // Validate postId format
    const postIdValidation = schedulePostIdSchema.safeParse({ postId });
    if (!postIdValidation.success) {
      const errors = postIdValidation.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const updatedSchedule = await videoScheduleService.deleteSchedulePostById(
      scheduleId,
      postId,
      userId
    );

    if (!updatedSchedule) {
      return ResponseHelper.notFound(res, "Schedule not found or not active");
    }

    return ResponseHelper.success(res, "Post deleted successfully", {
      scheduleId: updatedSchedule._id.toString(),
      deletedPostId: postId,
      remainingPosts: updatedSchedule.generatedTrends.length,
      scheduleInfo: formatScheduleInfo(updatedSchedule),
    });
  } catch (error: any) {
    console.error("Error in deleteSchedulePost:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to delete schedule post",
    });
  }
}

/**
 * Get a specific schedule post
 */
export async function getSchedulePost(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { scheduleId, postId } = req.params;
    const timezone = TimezoneService.detectTimezone(req);

    // Validate postId format
    const postIdValidation = schedulePostIdSchema.safeParse({ postId });
    if (!postIdValidation.success) {
      const errors = postIdValidation.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const result = await videoScheduleService.getSchedulePostById(
      scheduleId,
      postId,
      userId
    );

    if (!result) {
      return ResponseHelper.notFound(res, "Schedule or post not found");
    }

    const { schedule, post, postIndex } = result;

    return ResponseHelper.success(res, "Schedule post retrieved successfully", {
      scheduleId: schedule._id.toString(),
      postId,
      postIndex,
      timezone,
      post: formatPostData(post, postId, timezone, true),
      scheduleInfo: formatScheduleInfo(schedule),
    });
  } catch (error: any) {
    console.error("Error in getSchedulePost:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get schedule post",
    });
  }
}

/**
 * Delete entire schedule
 */
export async function deleteEntireSchedule(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { scheduleId } = req.params;

    // Validate scheduleId
    const validationResult = scheduleIdSchema.safeParse({ scheduleId });
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const deleted = await videoScheduleService.deleteEntireSchedule(
      scheduleId,
      userId
    );

    if (!deleted) {
      return ResponseHelper.notFound(res, "Schedule not found or not active");
    }

    return ResponseHelper.success(res, "Schedule deleted successfully", {
      deletedScheduleId: scheduleId,
      deletedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in deleteEntireSchedule:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to delete schedule",
    });
  }
}
