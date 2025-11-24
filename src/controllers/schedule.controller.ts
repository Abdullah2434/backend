import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import VideoScheduleService from "../services/videoSchedule.service";
import TimezoneService from "../utils/timezone";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateEditSchedulePost,
  validateSchedulePostId,
  validateScheduleId,
} from "../validations/schedule.validations";
import {
  getUserIdFromRequest,
  parsePostId,
  formatPostData,
  formatScheduleInfo,
  getErrorStatus,
  prepareUpdateData,
} from "../utils/scheduleHelpers";

// ==================== SERVICE INSTANCE ====================
const videoScheduleService = new VideoScheduleService();

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
    const postIdValidation = validateSchedulePostId({ postId });
    if (!postIdValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        postIdValidation.errors
      );
    }

    // Validate request body
    const validationResult = validateEditSchedulePost(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    // Prepare update data
    let updateData: any;
    try {
      updateData = prepareUpdateData(validationResult.data!, timezone);
    } catch (error: any) {
      return ResponseHelper.badRequest(
        res,
        error.message ||
          "Invalid scheduledFor date format or timezone conversion failed"
      );
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
    const postIdValidation = validateSchedulePostId({ postId });
    if (!postIdValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        postIdValidation.errors
      );
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
    const postIdValidation = validateSchedulePostId({ postId });
    if (!postIdValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        postIdValidation.errors
      );
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
    const validationResult = validateScheduleId({ scheduleId });
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
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
