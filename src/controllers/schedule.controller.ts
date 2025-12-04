import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import VideoScheduleService from "../services/videoSchedule";
import { IVideoSchedule } from "../services/videoSchedule/types";
import TimezoneService from "../utils/timezone";
import { ResponseHelper } from "../utils/responseHelper";
import {
  editSchedulePostSchema,
  schedulePostIdSchema,
  scheduleIdSchema,
} from "../validations/schedule.validations";
import { ZodError } from "zod";
import {
  PostStatus,
  GeneratedTrend,
  FormattedPost,
  PostCounts,
  ScheduleInfo,
  UpdateData,
} from "../types/schedule.types";
import {
  POST_ID_SEPARATOR,
  POST_STATUSES,
} from "../constants/schedule.constants";

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

  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(
      "Invalid post ID format. Expected format: scheduleId_index"
    );
  }

  const index = parseInt(parts[1], 10);

  if (isNaN(index) || index < 0) {
    throw new Error("Invalid post index in post ID");
  }

  return {
    scheduleId: parts[0],
    index,
  };
}

/**
 * Format validation errors from Zod
 */
function formatValidationErrors(error: ZodError): Array<{
  field: string;
  message: string;
}> {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

/**
 * Format post data for response
 */
function formatPostData(
  post: GeneratedTrend,
  postId: string,
  timezone: string,
  includeVideoId: boolean = false
): FormattedPost {
  const formatted: FormattedPost = {
    id: postId,
    index: 0, // Will be set by caller if needed
    scheduleId: "",
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
  };

  if (includeVideoId && post.videoId) {
    formatted.videoId = post.videoId;
  }

  return formatted;
}

/**
 * Format schedule info for response
 */
function formatScheduleInfo(schedule: IVideoSchedule): ScheduleInfo {
  const trends = schedule.generatedTrends || [];
  const statusCounts = countPostsByStatus(trends);

  return {
    frequency: schedule.frequency,
    days: schedule.schedule?.days || [],
    times: schedule.schedule?.times || [],
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    isActive: schedule.isActive,
    status: schedule.status,
    totalVideos: trends.length,
    pendingVideos: statusCounts.pending,
    completedVideos: statusCounts.completed,
    processingVideos: statusCounts.processing,
    failedVideos: statusCounts.failed,
  };
}

/**
 * Count posts by status in a single pass
 */
function countPostsByStatus(trends: GeneratedTrend[]): PostCounts {
  return trends.reduce(
    (counts, trend) => {
      const status = trend.status as PostStatus;
      if (POST_STATUSES.includes(status)) {
        counts[status]++;
      }
      return counts;
    },
    { pending: 0, completed: 0, processing: 0, failed: 0 }
  );
}

/**
 * Group posts by status in a single pass
 */
function groupPostsByStatus(posts: FormattedPost[]): {
  pending: FormattedPost[];
  completed: FormattedPost[];
  processing: FormattedPost[];
  failed: FormattedPost[];
} {
  return posts.reduce(
    (groups, post) => {
      const status = post.status as PostStatus;
      if (POST_STATUSES.includes(status)) {
        groups[status].push(post);
      }
      return groups;
    },
    {
      pending: [] as FormattedPost[],
      completed: [] as FormattedPost[],
      processing: [] as FormattedPost[],
      failed: [] as FormattedPost[],
    }
  );
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
  }

  if (scheduledFor instanceof Date) {
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
 * Build update data object from request body
 */
function buildUpdateData(
  data: {
    description?: string;
    keypoints?: string;
    scheduledFor?: string | Date;
    captions?: {
      instagram?: string;
      facebook?: string;
      linkedin?: string;
      twitter?: string;
      tiktok?: string;
      youtube?: string;
    };
  },
  timezone: string
): UpdateData {
  const updateData: UpdateData = {};

  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  if (data.keypoints !== undefined) {
    updateData.keypoints = data.keypoints;
  }

  if (data.scheduledFor !== undefined) {
    const scheduledForUTC = convertScheduledForToUTC(
      data.scheduledFor,
      timezone
    );
    if (isNaN(scheduledForUTC.getTime())) {
      throw new Error("Invalid scheduledFor date format");
    }
    updateData.scheduledFor = scheduledForUTC;
  }

  if (data.captions !== undefined) {
    if (data.captions.instagram !== undefined) {
      updateData.instagram_caption = data.captions.instagram;
    }
    if (data.captions.facebook !== undefined) {
      updateData.facebook_caption = data.captions.facebook;
    }
    if (data.captions.linkedin !== undefined) {
      updateData.linkedin_caption = data.captions.linkedin;
    }
    if (data.captions.twitter !== undefined) {
      updateData.twitter_caption = data.captions.twitter;
    }
    if (data.captions.tiktok !== undefined) {
      updateData.tiktok_caption = data.captions.tiktok;
    }
    if (data.captions.youtube !== undefined) {
      updateData.youtube_caption = data.captions.youtube;
    }
  }

  return updateData;
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

/**
 * Handle controller errors consistently
 */
function handleControllerError(
  error: unknown,
  res: Response,
  functionName: string,
  defaultMessage: string
): Response {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`Error in ${functionName}:`, err);

  const status = getErrorStatus(err);
  return res.status(status).json({
    success: false,
    message: err.message || defaultMessage,
  });
}

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Get all pending schedule posts
 */
export async function getPendingSchedulePosts(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> {
  try {
    const userId = getUserIdFromRequest(req);
    const timezone = TimezoneService.detectTimezone(req);

    const schedule = await videoScheduleService.getUserSchedule(userId);

    if (!schedule) {
      return ResponseHelper.notFound(res, "No active schedule found");
    }

    const scheduleId = schedule._id.toString();
    const trends = schedule.generatedTrends as GeneratedTrend[];

    // Format all posts with proper typing
    const allPosts: FormattedPost[] = trends
      .map((trend, index) => {
        const postId = `${scheduleId}${POST_ID_SEPARATOR}${index}`;
        const formatted = formatPostData(trend, postId, timezone, true);
        return {
          ...formatted,
          index,
          scheduleId,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime()
      );

    // Group posts by status in a single pass
    const {
      pending: pendingPosts,
      completed: completedPosts,
      processing: processingPosts,
      failed: failedPosts,
    } = groupPostsByStatus(allPosts);

    const statusCounts = countPostsByStatus(trends);

    return ResponseHelper.success(
      res,
      "Schedule posts retrieved successfully",
      {
        id: scheduleId,
        status: schedule.status,
        timezone,
        totalPosts: allPosts.length,
        totalPendingPosts: statusCounts.pending,
        totalCompletedPosts: statusCounts.completed,
        totalProcessingPosts: statusCounts.processing,
        totalFailedPosts: statusCounts.failed,
        allPosts,
        pendingPosts,
        completedPosts,
        processingPosts,
        failedPosts,
        scheduleInfo: formatScheduleInfo(schedule),
      }
    );
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "getPendingSchedulePosts",
      "Failed to get pending schedule posts"
    );
  }
}

/**
 * Edit a schedule post
 */
export async function editSchedulePost(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> {
  try {
    const userId = getUserIdFromRequest(req);
    const { scheduleId, postId } = req.params;
    const timezone = TimezoneService.detectTimezone(req);

    // Validate postId format
    const postIdValidation = schedulePostIdSchema.safeParse({ postId });
    if (!postIdValidation.success) {
      const errors = formatValidationErrors(postIdValidation.error);
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    // Validate request body
    const validationResult = editSchedulePostSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    // Build update data with proper error handling
    let updateData: UpdateData;
    try {
      updateData = buildUpdateData(validationResult.data, timezone);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Invalid scheduledFor date format or timezone conversion failed";
      return ResponseHelper.badRequest(res, message);
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

    // Parse post ID to get index and retrieve updated post
    const { index } = parsePostId(postId);
    const updatedPost = updatedSchedule.generatedTrends[
      index
    ] as GeneratedTrend;

    return ResponseHelper.success(res, "Post updated successfully", {
      scheduleId: updatedSchedule._id.toString(),
      postId,
      postIndex: index,
      timezone,
      updatedPost: formatPostData(updatedPost, postId, timezone),
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "editSchedulePost",
      "Failed to edit schedule post"
    );
  }
}

/**
 * Delete a schedule post
 */
export async function deleteSchedulePost(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> {
  try {
    const userId = getUserIdFromRequest(req);
    const { scheduleId, postId } = req.params;

    // Validate postId format
    const postIdValidation = schedulePostIdSchema.safeParse({ postId });
    if (!postIdValidation.success) {
      const errors = formatValidationErrors(postIdValidation.error);
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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "deleteSchedulePost",
      "Failed to delete schedule post"
    );
  }
}

/**
 * Get a specific schedule post
 */
export async function getSchedulePost(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> {
  try {
    const userId = getUserIdFromRequest(req);
    const { scheduleId, postId } = req.params;
    const timezone = TimezoneService.detectTimezone(req);

    // Validate postId format
    const postIdValidation = schedulePostIdSchema.safeParse({ postId });
    if (!postIdValidation.success) {
      const errors = formatValidationErrors(postIdValidation.error);
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
    const typedPost = post as GeneratedTrend;

    return ResponseHelper.success(res, "Schedule post retrieved successfully", {
      scheduleId: schedule._id.toString(),
      postId,
      postIndex,
      timezone,
      post: formatPostData(typedPost, postId, timezone, true),
      scheduleInfo: formatScheduleInfo(schedule),
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "getSchedulePost",
      "Failed to get schedule post"
    );
  }
}

/**
 * Delete entire schedule
 */
export async function deleteEntireSchedule(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> {
  try {
    const userId = getUserIdFromRequest(req);
    const { scheduleId } = req.params;

    // Validate scheduleId
    const validationResult = scheduleIdSchema.safeParse({ scheduleId });
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "deleteEntireSchedule",
      "Failed to delete schedule"
    );
  }
}
