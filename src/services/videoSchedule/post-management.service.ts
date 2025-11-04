import VideoSchedule, { IVideoSchedule } from "../../models/VideoSchedule";

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
      `✅ Updated post ${postId} in schedule ${scheduleId} for user ${userId}`
    );

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
