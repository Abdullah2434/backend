import { AuthenticatedRequest } from "../types";
import TimezoneService from "./timezone";
import { POST_ID_SEPARATOR } from "../constants/schedule.constants";

// ==================== HELPER FUNCTIONS ====================

/**
 * Get user ID from authenticated request
 */
export function getUserIdFromRequest(req: AuthenticatedRequest): string {
  if (!req.user?._id) {
    throw new Error("User not authenticated");
  }
  return req.user._id;
}

/**
 * Parse post ID to extract schedule ID and index
 */
export function parsePostId(postId: string): {
  scheduleId: string;
  index: number;
} {
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
export function formatPostData(
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
export function formatScheduleInfo(schedule: any) {
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
export function convertScheduledForToUTC(
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
export function getErrorStatus(error: Error): number {
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
 * Prepare update data from validated request body
 */
export function prepareUpdateData(
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
): any {
  const updateData: any = {};

  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.keypoints !== undefined) {
    updateData.keypoints = data.keypoints;
  }

  // Convert scheduledFor to UTC if provided
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

  // Handle captions object
  if (data.captions !== undefined) {
    if (data.captions.instagram !== undefined)
      updateData.instagram_caption = data.captions.instagram;
    if (data.captions.facebook !== undefined)
      updateData.facebook_caption = data.captions.facebook;
    if (data.captions.linkedin !== undefined)
      updateData.linkedin_caption = data.captions.linkedin;
    if (data.captions.twitter !== undefined)
      updateData.twitter_caption = data.captions.twitter;
    if (data.captions.tiktok !== undefined)
      updateData.tiktok_caption = data.captions.tiktok;
    if (data.captions.youtube !== undefined)
      updateData.youtube_caption = data.captions.youtube;
  }

  return updateData;
}

