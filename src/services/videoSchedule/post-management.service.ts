import VideoSchedule, { IVideoSchedule } from "../../models/VideoSchedule";
import { generateFromDescription } from "../trends.service";

export class VideoSchedulePostManagement {
  /**
   * Update individual post in a schedule
   */
  async updateSchedulePost(
    scheduleId: string,
    postIndex: number,
    userId: string,
    updateData: {
      description?: string;
      keypoints?: string;
      scheduledFor?: Date;
      instagram_caption?: string;
      facebook_caption?: string;
      linkedin_caption?: string;
      twitter_caption?: string;
      tiktok_caption?: string;
      youtube_caption?: string;
    }
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

    // Only allow editing if post is still pending
    if (post.status !== "pending") {
      throw new Error("Can only edit pending posts");
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

    console.log(
      `✅ Updated post ${postIndex} in schedule ${scheduleId} for user ${userId}`
    );

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
    updateData: {
      description?: string;
      keypoints?: string;
      scheduledFor?: Date;
      instagram_caption?: string;
      facebook_caption?: string;
      linkedin_caption?: string;
      twitter_caption?: string;
      tiktok_caption?: string;
      youtube_caption?: string;
    }
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

    // Only allow editing if post is still pending
    if (post.status !== "pending") {
      throw new Error("Can only edit pending posts");
    }

    // Store original values to detect changes
    const originalDescription = post.description;
    const originalKeypoints = post.keypoints;
    let newKeypoints = updateData.keypoints;

    // IMPORTANT: Only fetch new keypoints from OpenAI if description (topic) changes
    // If description doesn't change, keep existing keypoints (no OpenAI call)
    // If keypoints are explicitly provided, use those instead of fetching
    if (
      updateData.description !== undefined &&
      updateData.description.trim() !== originalDescription.trim() &&
      updateData.keypoints === undefined
    ) {
      // Description changed and keypoints not provided → fetch new keypoints from OpenAI
      console.log(
        `🔄 Topic changed from "${originalDescription}" to "${updateData.description}". Fetching new key points from OpenAI...`
      );
      try {
        const trendData = await generateFromDescription(updateData.description);
        newKeypoints = trendData.keypoints;
        console.log(
          `✅ Generated new key points from OpenAI based on new topic`
        );
        console.log(`📝 New key points: ${newKeypoints}`);
      } catch (error: any) {
        console.error(
          `❌ Failed to generate key points from OpenAI:`,
          error.message
        );
        // If generation fails, keep existing keypoints
        newKeypoints = originalKeypoints;
        console.log(`⚠️ Keeping existing key points due to OpenAI error`);
      }
    } else if (
      updateData.description === undefined ||
      updateData.description.trim() === originalDescription.trim()
    ) {
      // Description not changed → keep existing keypoints (no OpenAI call)
      if (updateData.keypoints === undefined) {
        newKeypoints = originalKeypoints; // Keep existing
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
    // Captions are only updated if explicitly provided - no automatic regeneration
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

    // Save the updated schedule to database
    await schedule.save();

    console.log(
      `✅ Updated post ${postId} in schedule ${scheduleId} for user ${userId}`
    );

    // Log what was updated
    if (
      updateData.description !== undefined &&
      updateData.description.trim() !== originalDescription.trim()
    ) {
      console.log(
        `📝 Topic updated: "${originalDescription}" → "${updateData.description}"`
      );
    }
    if (newKeypoints && newKeypoints !== originalKeypoints) {
      console.log(
        `📝 Key points automatically updated in database from OpenAI`
      );
      console.log(`   Old: ${originalKeypoints}`);
      console.log(`   New: ${newKeypoints}`);
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

    // Allow deleting posts in any status (pending, completed, processing, failed)
    // This gives users flexibility to clean up their schedule
    console.log(`🗑️ Deleting post with status: ${post.status}`);

    // Remove the post from the array
    schedule.generatedTrends.splice(postIndex, 1);

    // Save the updated schedule
    await schedule.save();

    console.log(
      `🗑️ Deleted post ${postIndex} (status: ${post.status}) from schedule ${scheduleId} for user ${userId}`
    );

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

    // Allow deleting posts in any status (pending, completed, processing, failed)
    // This gives users flexibility to clean up their schedule
    console.log(`🗑️ Deleting post with status: ${post.status}`);

    // Remove the post from the array
    schedule.generatedTrends.splice(postIndex, 1);

    // Save the updated schedule
    await schedule.save();

    console.log(
      `🗑️ Deleted post ${postId} (status: ${post.status}) from schedule ${scheduleId} for user ${userId}`
    );

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
      throw new Error("Schedule not found or not active");
    }

    if (postIndex < 0 || postIndex >= schedule.generatedTrends.length) {
      throw new Error("Post index out of range");
    }

    const post = schedule.generatedTrends[postIndex];
    if (!post) {
      throw new Error("Post not found");
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

    return {
      schedule,
      post,
      postIndex,
    };
  }
}
