import VideoSchedule, { IVideoSchedule } from "../../models/VideoSchedule";
import { generateFromDescription, DynamicPostGenerationService } from "../content";
import UserVideoSettings from "../../models/UserVideoSettings";
import { VideoScheduleCaptionGeneration } from "./caption-generation.service";
import {
  ERROR_MESSAGES,
  STATUS_PENDING,
  SOCIAL_MEDIA_PLATFORMS,
  CAPTION_STATUS_READY,
} from "../../constants/videoScheduleService.constants";
import {
  UpdatePostData,
  UserContext,
} from "../../types/videoScheduleService.types";
import {
  parsePostId,
  validatePostIndex,
  getDynamicCaption,
} from "../../utils/videoScheduleServiceHelpers";

export class VideoSchedulePostManagement {
  /**
   * Update individual post in a schedule
   */
  async updateSchedulePost(
    scheduleId: string,
    postIndex: number,
    userId: string,
    updateData: UpdatePostData
  ): Promise<IVideoSchedule | null> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error(ERROR_MESSAGES.SCHEDULE_NOT_ACTIVE);
    }

    validatePostIndex(postIndex, schedule.generatedTrends.length);

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error(ERROR_MESSAGES.POST_NOT_FOUND);
    }

    // Only allow editing if post is still pending
    if (post.status !== STATUS_PENDING) {
      throw new Error(ERROR_MESSAGES.CAN_ONLY_EDIT_PENDING);
    }

    // Update the post fields
    if (updateData.description !== undefined) {
      post.description = updateData.description;
    }
    if (updateData.keypoints !== undefined) {
      post.keypoints = updateData.keypoints;
    }
    if (updateData.scheduledFor !== undefined) {
      post.scheduledFor = updateData.scheduledFor;
    }
    if (updateData.instagram_caption !== undefined) {
      post.instagram_caption = updateData.instagram_caption;
    }
    if (updateData.facebook_caption !== undefined) {
      post.facebook_caption = updateData.facebook_caption;
    }
    if (updateData.linkedin_caption !== undefined) {
      post.linkedin_caption = updateData.linkedin_caption;
    }
    if (updateData.twitter_caption !== undefined) {
      post.twitter_caption = updateData.twitter_caption;
    }
    if (updateData.tiktok_caption !== undefined) {
      post.tiktok_caption = updateData.tiktok_caption;
    }
    if (updateData.youtube_caption !== undefined) {
      post.youtube_caption = updateData.youtube_caption;
    }

    // Save the updated schedule
    await schedule.save();

    return schedule;
  }

  /**
   * Update individual post in a schedule by post ID
   * Automatically fetches new key points from OpenAI if topic (description) changes
   * Captions are only updated if explicitly provided in updateData
   */
  async updateSchedulePostById(
    scheduleId: string,
    postId: string,
    userId: string,
    updateData: UpdatePostData
  ): Promise<IVideoSchedule | null> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error(ERROR_MESSAGES.SCHEDULE_NOT_ACTIVE);
    }

    // Parse post ID to get index
    const postIndex = parsePostId(postId);
    validatePostIndex(postIndex, schedule.generatedTrends.length);

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error(ERROR_MESSAGES.POST_NOT_FOUND);
    }

    // Only allow editing if post is still pending
    if (post.status !== STATUS_PENDING) {
      throw new Error(ERROR_MESSAGES.CAN_ONLY_EDIT_PENDING);
    }

    // Store original values to detect changes
    const originalDescription = post.description;
    const originalKeypoints = post.keypoints;
    let newKeypoints = updateData.keypoints;

    // Check if description changed
    const descriptionChanged =
      updateData.description !== undefined &&
      updateData.description.trim() !== originalDescription.trim();

    if (descriptionChanged && updateData.keypoints === undefined) {

      try {
        // TypeScript: description is guaranteed to be defined here because descriptionChanged is true
        const description = updateData.description!;
        const trendData = await generateFromDescription(description);
        newKeypoints = trendData.keypoints;
       
      } catch (error: any) {
      
        // If generation fails, keep existing keypoints
        newKeypoints = originalKeypoints;

      }
    } else if (!descriptionChanged) {
      // Description not changed → keep existing keypoints (no OpenAI call)
      if (updateData.keypoints === undefined) {
        newKeypoints = originalKeypoints; // Keep existing
      }
    }

    // Generate dynamic captions when description changes (same method as schedule creation)
    if (descriptionChanged) {

      try {
        // Fetch user settings for context
        const userSettings = await UserVideoSettings.findOne({ userId });
       

        // Create user context from user settings (provide defaults if not available)
        const userContext = userSettings
          ? {
              name: userSettings.name || "",
              position: userSettings.position || "",
              companyName: userSettings.companyName || "",
              city: userSettings.city || "",
              socialHandles: userSettings.socialHandles || "",
            }
          : {
              name: "",
              position: "",
              companyName: "",
              city: "",
              socialHandles: "",
            };

        // Use the new description and new keypoints for caption generation
        const descriptionForCaptions =
          updateData.description || originalDescription;
        const keypointsForCaptions = newKeypoints || originalKeypoints;

        // Generate dynamic posts using the same method as schedule creation
        const dynamicPosts =
          await DynamicPostGenerationService.generateDynamicPosts(
            descriptionForCaptions,
            keypointsForCaptions,
            userContext,
            userId,
            [...SOCIAL_MEDIA_PLATFORMS],
            userSettings?.language
          );

        // Extract captions using the helper method
        const generatedCaptions = {
          instagram_caption: getDynamicCaption(dynamicPosts, "instagram"),
          facebook_caption: getDynamicCaption(dynamicPosts, "facebook"),
          linkedin_caption: getDynamicCaption(dynamicPosts, "linkedin"),
          twitter_caption: getDynamicCaption(dynamicPosts, "twitter"),
          tiktok_caption: getDynamicCaption(dynamicPosts, "tiktok"),
          youtube_caption: getDynamicCaption(dynamicPosts, "youtube"),
        };

        // Replace ALL old captions with new generated ones (ignore user-provided captions when description changes)
        post.instagram_caption = generatedCaptions.instagram_caption;
        post.facebook_caption = generatedCaptions.facebook_caption;
        post.linkedin_caption = generatedCaptions.linkedin_caption;
        post.twitter_caption = generatedCaptions.twitter_caption;
        post.tiktok_caption = generatedCaptions.tiktok_caption;
        post.youtube_caption = generatedCaptions.youtube_caption;
        post.enhanced_with_dynamic_posts = true;
        post.caption_status = CAPTION_STATUS_READY;
        post.caption_processed_at = new Date();

      } catch (error: any) {
     
        // Continue with existing captions as fallback - don't fail the entire update
      }
    }

    // Update the post fields
    if (updateData.description !== undefined) {
      post.description = updateData.description;
    }
    // Update keypoints: use new ones from OpenAI if topic changed, or use provided ones, or keep existing
    if (newKeypoints !== undefined) {
      post.keypoints = newKeypoints;
    } else if (updateData.keypoints !== undefined) {
      post.keypoints = updateData.keypoints;
    }
    if (updateData.scheduledFor !== undefined) {
      post.scheduledFor = updateData.scheduledFor;
    }

    // Captions handling:
    // - If description changed: captions were already generated above (user-provided captions are ignored)
    // - If description didn't change: only update captions that are explicitly provided
    if (!descriptionChanged) {
      // Description didn't change - use user-provided captions (only update provided ones)
      if (updateData.instagram_caption !== undefined) {
        post.instagram_caption = updateData.instagram_caption;
      }
      if (updateData.facebook_caption !== undefined) {
        post.facebook_caption = updateData.facebook_caption;
      }
      if (updateData.linkedin_caption !== undefined) {
        post.linkedin_caption = updateData.linkedin_caption;
      }
      if (updateData.twitter_caption !== undefined) {
        post.twitter_caption = updateData.twitter_caption;
      }
      if (updateData.tiktok_caption !== undefined) {
        post.tiktok_caption = updateData.tiktok_caption;
      }
      if (updateData.youtube_caption !== undefined) {
        post.youtube_caption = updateData.youtube_caption;
      }
    }

    // Save the updated schedule to database
    await schedule.save();

    // Log what was updated
    if (
      updateData.description !== undefined &&
      updateData.description.trim() !== originalDescription.trim()
    ) {
   
    }
    if (newKeypoints && newKeypoints !== originalKeypoints) {
   
    }

    return schedule;
  }

  /**
   * Delete individual post from a schedule
   */
  async deleteSchedulePost(
    scheduleId: string,
    postIndex: number,
    userId: string
  ): Promise<IVideoSchedule | null> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found or not active");
    }

    if (postIndex < 0 || postIndex >= schedule.generatedTrends.length) {
      throw new Error("Post index out of range");
    }

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error("Post not found");
    }

   

    // Remove the post from the array
    schedule.generatedTrends.splice(postIndex, 1);

    // Save the updated schedule
    await schedule.save();


    return schedule;
  }

  /**
   * Delete individual post from a schedule by post ID
   */
  async deleteSchedulePostById(
    scheduleId: string,
    postId: string,
    userId: string
  ): Promise<IVideoSchedule | null> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found or not active");
    }

    // Parse post ID to get index
    const parts = postId.split("_");
    if (parts.length !== 2) {
      throw new Error("Invalid post ID format");
    }

    const postIndex = parseInt(parts[1]);
    if (
      isNaN(postIndex) ||
      postIndex < 0 ||
      postIndex >= schedule.generatedTrends.length
    ) {
      throw new Error("Post not found");
    }

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error("Post not found");
    }



    // Remove the post from the array
    schedule.generatedTrends.splice(postIndex, 1);

    // Save the updated schedule
    await schedule.save();

    

    return schedule;
  }

  /**
   * Get a single post from a schedule
   */
  async getSchedulePost(
    scheduleId: string,
    postIndex: number,
    userId: string
  ): Promise<{
    schedule: IVideoSchedule;
    post: any;
    postIndex: number;
  } | null> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error(ERROR_MESSAGES.SCHEDULE_NOT_ACTIVE);
    }

    validatePostIndex(postIndex, schedule.generatedTrends.length);

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error(ERROR_MESSAGES.POST_NOT_FOUND);
    }

    return {
      schedule,
      post,
      postIndex,
    };
  }

  /**
   * Get a single post from a schedule by post ID
   */
  async getSchedulePostById(
    scheduleId: string,
    postId: string,
    userId: string
  ): Promise<{
    schedule: IVideoSchedule;
    post: any;
    postIndex: number;
  } | null> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error(ERROR_MESSAGES.SCHEDULE_NOT_ACTIVE);
    }

    // Parse post ID to get index
    const postIndex = parsePostId(postId);
    validatePostIndex(postIndex, schedule.generatedTrends.length);

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error(ERROR_MESSAGES.POST_NOT_FOUND);
    }

    return {
      schedule,
      post,
      postIndex,
    };
  }
}
