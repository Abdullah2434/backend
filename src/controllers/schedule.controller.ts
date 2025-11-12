import { Request, Response } from "express";
import VideoScheduleService from "../services/videoSchedule.service";
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
 * Get pending schedule posts for the authenticated user
 * This endpoint returns only the pending posts from the user's active schedule
 *
 * Usage:
 * curl -H "Authorization: Bearer <token>" \
 *      -H "x-timezone: America/New_York" \
 *      http://localhost:4000/api/schedule
 */
export async function getPendingSchedulePosts(req: Request, res: Response) {
  try {
  

    // Authenticate user and extract userId from token
    const payload = requireAuth(req);

    // Detect timezone from request headers
    const timezone = TimezoneService.detectTimezone(req);


    // Get user's active schedule
    const schedule = await videoScheduleService.getUserSchedule(payload.userId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "No active schedule found",
      });
    }

    // Get all posts (pending, completed, processing, failed)
    const allPosts = schedule.generatedTrends
      .map((trend: any, index) => ({
        id: `${schedule._id}_${index}`, // Use scheduleId_index format
        index: index, // Add index field
        scheduleId: schedule._id, // Add scheduleId field
        description: trend.description,
        keypoints: trend.keypoints,
        scheduledFor: trend.scheduledFor,
        status: trend.status,
        captions: {
          // Changed from socialCaptions to captions
          instagram: trend.instagram_caption,
          facebook: trend.facebook_caption,
          linkedin: trend.linkedin_caption,
          twitter: trend.twitter_caption,
          tiktok: trend.tiktok_caption,
          youtube: trend.youtube_caption,
        },
        // Convert scheduled time to user's timezone for display
        scheduledForLocal: TimezoneService.convertFromUTC(
          trend.scheduledFor,
          timezone
        ),
        videoId: trend.videoId, // Add videoId for completed posts
      }))
      .sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime()
      ); // Sort by scheduled time

    // Separate posts by status for better organization
    const pendingPosts = allPosts.filter((post) => post.status === "pending");
    const completedPosts = allPosts.filter(
      (post) => post.status === "completed"
    );
    const processingPosts = allPosts.filter(
      (post) => post.status === "processing"
    );
    const failedPosts = allPosts.filter((post) => post.status === "failed");

    console.log(
      `📊 Found ${allPosts.length} total posts for user ${payload.userId} (${pendingPosts.length} pending, ${completedPosts.length} completed, ${processingPosts.length} processing, ${failedPosts.length} failed)`
    );

    return res.json({
      success: true,
      data: {
        id: schedule._id, // Changed from scheduleId to id
        status: schedule.status, // Schedule status (processing, ready, failed)
        timezone: timezone,
        totalPosts: allPosts.length,
        totalPendingPosts: pendingPosts.length,
        totalCompletedPosts: completedPosts.length,
        totalProcessingPosts: processingPosts.length,
        totalFailedPosts: failedPosts.length,
        allPosts: allPosts, // All posts in one array
        pendingPosts: pendingPosts, // Only pending posts (for backward compatibility)
        completedPosts: completedPosts, // Only completed posts
        processingPosts: processingPosts, // Only processing posts
        failedPosts: failedPosts, // Only failed posts
        scheduleInfo: {
          frequency: schedule.frequency,
          days: schedule.schedule.days, // Add days field
          times: schedule.schedule.times, // Add times field
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          isActive: schedule.isActive,
          status: schedule.status, // Schedule creation status (processing, ready, failed)
        },
      },
    });
  } catch (e: any) {
    console.error("Error getting pending schedule posts:", e);

    // Handle authentication errors
    if (e.message.includes("token") || e.message.includes("Token")) {
      return res.status(401).json({
        success: false,
        message: e.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: e.message || "Failed to get pending schedule posts",
    });
  }
}

/**
 * Edit a single post in the user's schedule
 *
 * Usage:
 * curl -X PUT \
 *      -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *      -H "x-timezone: America/New_York" \
 *      -H "Content-Type: application/json" \
 *      -d '{
 *        "description": "Updated description for this trend",
 *        "keypoints": "Updated key point 1, Updated key point 2, Updated key point 3",
 *        "captions": {
 *          "instagram": "Updated Instagram caption with hashtags #RealEstate #Updated",
 *          "facebook": "Updated Facebook caption with more detailed content...",
 *          "linkedin": "Updated LinkedIn caption for professional audience...",
 *          "twitter": "Updated Twitter caption #RealEstate #Updated",
 *          "tiktok": "Updated TikTok caption with trending content...",
 *          "youtube": "Updated YouTube caption for video content..."
 *        },
 *        "scheduledFor": "2024-01-20 15:30:00"
 *      }' \
 *      http://localhost:4000/api/schedule/SCHEDULE_ID/post/POST_INDEX
 */
export async function editSchedulePost(req: Request, res: Response) {
  try {
    console.log("✏️ Editing schedule post...");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    // Authenticate user and extract userId from token
    const payload = requireAuth(req);

    // Extract scheduleId and postId from URL parameters
    const { scheduleId, postId } = req.params;

    // Validate postId format
    if (!postId || !postId.includes("_")) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format. Expected format: scheduleId_index",
      });
    }

    // Detect timezone from request headers
    const timezone = TimezoneService.detectTimezone(req);
    console.log("🌍 Detected timezone:", timezone);

    // Extract update data from request body
    const { description, keypoints, scheduledFor, captions } = req.body;

    // Validate that at least one field is provided for update
    const updateFields = {
      description,
      keypoints,
      scheduledFor,
      captions,
    };

    const hasUpdates = Object.values(updateFields).some(
      (value) => value !== undefined
    );
    if (!hasUpdates) {
      return res.status(400).json({
        success: false,
        message: "At least one field must be provided for update",
      });
    }

    // Convert scheduledFor to UTC if provided (avoid double conversion if already UTC/ISO with zone)
    let scheduledForUTC = scheduledFor;
    if (scheduledFor) {
      try {
        // If it's a string, convert it to Date
        if (typeof scheduledFor === "string") {
          // Convert user's local time to UTC using their timezone, unless the string already contains a timezone
          scheduledForUTC = TimezoneService.ensureUTCDate(
            scheduledFor,
            timezone
          );
          console.log(
            `🕐 Converted "${scheduledFor}" from ${timezone} to UTC: ${scheduledForUTC.toISOString()}`
          );
        } else if (scheduledFor instanceof Date) {
          // If it's already a Date object, assume it's in user's timezone and convert to UTC
          const dateString = scheduledFor
            .toISOString()
            .replace("T", " ")
            .replace("Z", "")
            .split(".")[0];
          scheduledForUTC = TimezoneService.ensureUTCDate(dateString, timezone);
          console.log(
            `🕐 Converted Date object from ${timezone} to UTC: ${scheduledForUTC.toISOString()}`
          );
        }

        // Validate the date
        if (isNaN(scheduledForUTC.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid scheduledFor date format",
          });
        }
      } catch (error) {
        console.error("Error converting scheduledFor to UTC:", error);
        return res.status(400).json({
          success: false,
          message:
            "Invalid scheduledFor date format or timezone conversion failed",
        });
      }
    }

    // Validate captions structure if provided
    if (captions !== undefined) {
      if (typeof captions !== "object" || captions === null) {
        return res.status(400).json({
          success: false,
          message: "Captions must be an object",
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (description !== undefined) updateData.description = description;
    if (keypoints !== undefined) updateData.keypoints = keypoints;
    if (scheduledForUTC !== undefined)
      updateData.scheduledFor = scheduledForUTC;

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

    console.log(
      `📝 Updating post ${postId} in schedule ${scheduleId} for user ${payload.userId}`
    );

    // Update the post
    const updatedSchedule = await videoScheduleService.updateSchedulePostById(
      scheduleId,
      postId,
      payload.userId,
      updateData
    );

    if (!updatedSchedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found or not active",
      });
    }

    // Parse post ID to get index for response
    const parts = postId.split("_");
    const postIndex = parseInt(parts[1]);

    // Get the updated post
    const updatedPost = updatedSchedule.generatedTrends[postIndex];

    console.log(
      `✅ Successfully updated post ${postId} in schedule ${scheduleId}`
    );

    return res.json({
      success: true,
      message: "Post updated successfully",
      data: {
        scheduleId: updatedSchedule._id,
        postId: postId,
        postIndex: postIndex,
        timezone: timezone,
        updatedPost: {
          id: postId,
          description: updatedPost.description,
          keypoints: updatedPost.keypoints,
          scheduledFor: updatedPost.scheduledFor,
          status: updatedPost.status,
          scheduledForLocal: TimezoneService.convertFromUTC(
            updatedPost.scheduledFor,
            timezone
          ),
          socialCaptions: {
            instagram: updatedPost.instagram_caption,
            facebook: updatedPost.facebook_caption,
            linkedin: updatedPost.linkedin_caption,
            twitter: updatedPost.twitter_caption,
            tiktok: updatedPost.tiktok_caption,
            youtube: updatedPost.youtube_caption,
          },
        },
      },
    });
  } catch (e: any) {
    console.error("Error editing schedule post:", e);

    // Handle specific error cases
    if (e.message.includes("Schedule not found")) {
      return res.status(404).json({
        success: false,
        message: e.message,
      });
    }

    if (
      e.message.includes("Post index out of range") ||
      e.message.includes("Post not found")
    ) {
      return res.status(400).json({
        success: false,
        message: e.message,
      });
    }

    if (e.message.includes("Can only edit pending posts")) {
      return res.status(400).json({
        success: false,
        message: e.message,
      });
    }

    // Handle authentication errors
    if (e.message.includes("token") || e.message.includes("Token")) {
      return res.status(401).json({
        success: false,
        message: e.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: e.message || "Failed to edit schedule post",
    });
  }
}

/**
 * Delete a single post from the user's schedule
 *
 * Usage:
 * curl -X DELETE \
 *      -H "Authorization: Bearer <token>" \
 *      http://localhost:4000/api/schedule/64f1a2b3c4d5e6f7g8h9i0j1/post/1
 */
export async function deleteSchedulePost(req: Request, res: Response) {
  try {
    console.log("🗑️ Deleting schedule post...");

    // Authenticate user and extract userId from token
    const payload = requireAuth(req);

    // Extract scheduleId and postId from URL parameters
    const { scheduleId, postId } = req.params;

    // Validate postId format
    if (!postId || !postId.includes("_")) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format. Expected format: scheduleId_index",
      });
    }

    console.log(
      `🗑️ Deleting post ${postId} from schedule ${scheduleId} for user ${payload.userId}`
    );

    // Delete the post
    const updatedSchedule = await videoScheduleService.deleteSchedulePostById(
      scheduleId,
      postId,
      payload.userId
    );

    if (!updatedSchedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found or not active",
      });
    }

    console.log(
      `✅ Successfully deleted post ${postId} from schedule ${scheduleId}`
    );

    return res.json({
      success: true,
      message: "Post deleted successfully",
      data: {
        scheduleId: updatedSchedule._id,
        deletedPostId: postId,
        remainingPosts: updatedSchedule.generatedTrends.length,
        scheduleInfo: {
          frequency: updatedSchedule.frequency,
          startDate: updatedSchedule.startDate,
          endDate: updatedSchedule.endDate,
          isActive: updatedSchedule.isActive,
          totalVideos: updatedSchedule.generatedTrends.length,
          pendingVideos: updatedSchedule.generatedTrends.filter(
            (t) => t.status === "pending"
          ).length,
          completedVideos: updatedSchedule.generatedTrends.filter(
            (t) => t.status === "completed"
          ).length,
          processingVideos: updatedSchedule.generatedTrends.filter(
            (t) => t.status === "processing"
          ).length,
          failedVideos: updatedSchedule.generatedTrends.filter(
            (t) => t.status === "failed"
          ).length,
        },
      },
    });
  } catch (e: any) {
    console.error("Error deleting schedule post:", e);

    // Handle specific error cases
    if (e.message.includes("Schedule not found")) {
      return res.status(404).json({
        success: false,
        message: e.message,
      });
    }

    if (
      e.message.includes("Post index out of range") ||
      e.message.includes("Post not found")
    ) {
      return res.status(400).json({
        success: false,
        message: e.message,
      });
    }

    if (e.message.includes("Can only delete pending posts")) {
      return res.status(400).json({
        success: false,
        message: e.message,
      });
    }

    // Handle authentication errors
    if (e.message.includes("token") || e.message.includes("Token")) {
      return res.status(401).json({
        success: false,
        message: e.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: e.message || "Failed to delete schedule post",
    });
  }
}

/**
 * Get a single post from the user's schedule by post ID
 *
 * Usage:
 * curl -H "Authorization: Bearer <token>" \
 *      -H "x-timezone: America/New_York" \
 *      http://localhost:4000/api/schedule/64f1a2b3c4d5e6f7g8h9i0j1/post/68ed0c8a9ff65c5692f718f4_0
 */
export async function getSchedulePost(req: Request, res: Response) {
  try {
    console.log("📋 Getting single schedule post...");

    // Authenticate user and extract userId from token
    const payload = requireAuth(req);

    // Extract scheduleId and postId from URL parameters
    const { scheduleId, postId } = req.params;

    // Validate postId format
    if (!postId || !postId.includes("_")) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format. Expected format: scheduleId_index",
      });
    }

    // Detect timezone from request headers
    const timezone = TimezoneService.detectTimezone(req);
    console.log("🌍 Detected timezone:", timezone);

    console.log(
      `📋 Getting post ${postId} from schedule ${scheduleId} for user ${payload.userId}`
    );

    // Get the post
    const result = await videoScheduleService.getSchedulePostById(
      scheduleId,
      postId,
      payload.userId
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Schedule or post not found",
      });
    }

    const { schedule, post, postIndex } = result;

    console.log(
      `✅ Successfully retrieved post ${postId} from schedule ${scheduleId}`
    );

    return res.json({
      success: true,
      data: {
        scheduleId: schedule._id,
        postId: postId,
        postIndex: postIndex,
        timezone: timezone,
        post: {
          id: postId,
          description: post.description,
          keypoints: post.keypoints,
          scheduledFor: post.scheduledFor,
          status: post.status,
          scheduledForLocal: TimezoneService.convertFromUTC(
            post.scheduledFor,
            timezone
          ),
          socialCaptions: {
            instagram: post.instagram_caption,
            facebook: post.facebook_caption,
            linkedin: post.linkedin_caption,
            twitter: post.twitter_caption,
            tiktok: post.tiktok_caption,
            youtube: post.youtube_caption,
          },
          videoId: post.videoId,
        },
        scheduleInfo: {
          frequency: schedule.frequency,
          days: schedule.schedule.days,
          times: schedule.schedule.times,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          isActive: schedule.isActive,
          totalVideos: schedule.generatedTrends.length,
          pendingVideos: schedule.generatedTrends.filter(
            (t) => t.status === "pending"
          ).length,
          completedVideos: schedule.generatedTrends.filter(
            (t) => t.status === "completed"
          ).length,
          processingVideos: schedule.generatedTrends.filter(
            (t) => t.status === "processing"
          ).length,
          failedVideos: schedule.generatedTrends.filter(
            (t) => t.status === "failed"
          ).length,
        },
      },
    });
  } catch (e: any) {
    console.error("Error getting schedule post:", e);

    // Handle specific error cases
    if (e.message.includes("Schedule not found")) {
      return res.status(404).json({
        success: false,
        message: e.message,
      });
    }

    if (
      e.message.includes("Post not found") ||
      e.message.includes("Invalid post ID")
    ) {
      return res.status(400).json({
        success: false,
        message: e.message,
      });
    }

    // Handle authentication errors
    if (e.message.includes("token") || e.message.includes("Token")) {
      return res.status(401).json({
        success: false,
        message: e.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: e.message || "Failed to get schedule post",
    });
  }
}

/**
 * Delete entire schedule
 *
 * Usage:
 * curl -X DELETE \
 *      -H "Authorization: Bearer <token>" \
 *      http://localhost:4000/api/schedule/64f1a2b3c4d5e6f7g8h9i0j1
 */
export async function deleteEntireSchedule(req: Request, res: Response) {
  try {
    console.log("🗑️ Deleting entire schedule...");

    // Authenticate user and extract userId from token
    const payload = requireAuth(req);

    // Extract scheduleId from URL parameters
    const { scheduleId } = req.params;

    console.log(
      `🗑️ Deleting entire schedule ${scheduleId} for user ${payload.userId}`
    );

    // Delete the entire schedule
    const deleted = await videoScheduleService.deleteEntireSchedule(
      scheduleId,
      payload.userId
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found or not active",
      });
    }

    console.log(`✅ Successfully deleted entire schedule ${scheduleId}`);

    return res.json({
      success: true,
      message: "Schedule deleted successfully",
      data: {
        deletedScheduleId: scheduleId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    console.error("Error deleting entire schedule:", e);

    // Handle specific error cases
    if (e.message.includes("Schedule not found")) {
      return res.status(404).json({
        success: false,
        message: e.message,
      });
    }

    // Handle authentication errors
    if (e.message.includes("token") || e.message.includes("Token")) {
      return res.status(401).json({
        success: false,
        message: e.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: e.message || "Failed to delete schedule",
    });
  }
}
