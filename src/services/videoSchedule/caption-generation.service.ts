import VideoSchedule from "../../models/VideoSchedule";

export class VideoScheduleCaptionGeneration {
  /**
   * Generate dynamic captions for trends using Enhanced Dynamic Template System
   */
  static async generateDynamicCaptionsForTrends(
    trends: any[],
    userSettings: any,
    userId: string
  ): Promise<any[]> {
    console.log(
      `🎯 Generating dynamic captions for ${trends.length} trends during schedule creation...`
    );

    const enhancedTrends = [];

    for (const trend of trends) {
      try {
        // Create user context from user settings
        const userContext = {
          name: userSettings.name,
          position: userSettings.position,
          companyName: userSettings.companyName,
          city: userSettings.city,
          socialHandles: userSettings.socialHandles,
        };

        // Generate dynamic posts for this trend
        const { DynamicPostGenerationService } = await import(
          "../dynamicPostGeneration.service"
        );
        const dynamicPosts =
          await DynamicPostGenerationService.generateDynamicPosts(
            trend.description,
            trend.keypoints,
            userContext,
            userId,
            [
              "instagram",
              "facebook",
              "linkedin",
              "twitter",
              "tiktok",
              "youtube",
            ]
          );

        // Create enhanced trend with dynamic captions
        const enhancedTrend = {
          ...trend,
          // Update captions with dynamic content
          instagram_caption: this.getDynamicCaption(dynamicPosts, "instagram"),
          facebook_caption: this.getDynamicCaption(dynamicPosts, "facebook"),
          linkedin_caption: this.getDynamicCaption(dynamicPosts, "linkedin"),
          twitter_caption: this.getDynamicCaption(dynamicPosts, "twitter"),
          tiktok_caption: this.getDynamicCaption(dynamicPosts, "tiktok"),
          youtube_caption: this.getDynamicCaption(dynamicPosts, "youtube"),
          // Add metadata
          enhanced_with_dynamic_posts: true,
          enhancement_timestamp: new Date().toISOString(),
        };

        enhancedTrends.push(enhancedTrend);
        console.log(
          `✅ Generated dynamic captions for trend: "${trend.description}"`
        );
      } catch (error) {
        console.warn(
          `⚠️ Failed to generate dynamic captions for trend "${trend.description}":`,
          error
        );
        // Keep original trend if enhancement fails
        enhancedTrends.push({
          ...trend,
          enhanced_with_dynamic_posts: false,
          enhancement_error:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return enhancedTrends;
  }

  /**
   * Queue background job to generate dynamic captions for ALL videos (async version)
   */
  static queueBackgroundCaptionGenerationAsync(
    scheduleId: string,
    userId: string,
    userSettings: any,
    totalVideos: number
  ): void {
    console.log(
      `🔄 Queuing background caption generation for ${totalVideos} videos...`
    );

    // Process all videos in background
    setImmediate(async () => {
      try {
        await this.processAllBackgroundCaptions(
          scheduleId,
          userId,
          userSettings,
          totalVideos
        );
      } catch (error: any) {
        console.error("❌ Background caption generation failed:", error);

        // Update schedule status to failed
        await VideoSchedule.findByIdAndUpdate(scheduleId, {
          status: "failed",
        });

        // Send failure notification
        const { notificationService } = await import("../notification.service");
        notificationService.notifyScheduleStatus(userId, "failed", {
          scheduleId,
          message: "Schedule creation failed",
          totalVideos,
          processedVideos: 0,
          errorDetails: error.message,
        });
      }
    });
  }

  /**
   * Process all background captions with progress updates
   */
  static async processAllBackgroundCaptions(
    scheduleId: string,
    userId: string,
    userSettings: any,
    totalVideos: number
  ): Promise<void> {
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    const { notificationService } = await import("../notification.service");
    let processedCount = 0;

    console.log(
      `🎯 Starting background caption generation for ${totalVideos} videos...`
    );

    // Process videos in batches of 3 to avoid rate limiting
    const batchSize = 3;
    const totalBatches = Math.ceil(totalVideos / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalVideos);

      console.log(
        `📦 Processing batch ${batchIndex + 1}/${totalBatches} (videos ${
          startIndex + 1
        }-${endIndex})...`
      );

      // Process videos in this batch
      const batchPromises = [];
      for (let i = startIndex; i < endIndex; i++) {
        if (schedule.generatedTrends[i]) {
          batchPromises.push(
            this.generateDynamicCaptionsForSingleTrend(
              schedule.generatedTrends[i],
              userSettings,
              userId,
              scheduleId,
              i
            )
          );
        }
      }

      try {
        await Promise.all(batchPromises);
        processedCount = endIndex;

        console.log(
          `✅ Batch ${
            batchIndex + 1
          } completed: ${processedCount}/${totalVideos} videos processed`
        );

        // Send progress notification
        notificationService.notifyScheduleStatus(userId, "processing", {
          scheduleId,
          message: "Generating dynamic captions...",
          totalVideos,
          processedVideos: processedCount,
        });

        // Add delay between batches to avoid rate limiting
        if (batchIndex < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`❌ Error in batch ${batchIndex + 1}:`, error);
        // Continue with next batch
      }
    }

    // Update schedule status to ready
    await VideoSchedule.findByIdAndUpdate(scheduleId, {
      status: "ready",
    });

    // Send completion notification
    notificationService.notifyScheduleStatus(userId, "ready", {
      scheduleId,
      message: "Schedule creation completed successfully",
      totalVideos,
      processedVideos: totalVideos,
    });

    console.log(
      `🎉 Background caption generation completed for schedule ${scheduleId}`
    );
  }

  /**
   * Generate dynamic captions for a single trend
   */
  static async generateDynamicCaptionsForSingleTrend(
    trend: any,
    userSettings: any,
    userId: string,
    scheduleId: string,
    trendIndex: number
  ): Promise<void> {
    try {
      // Create user context from user settings
      const userContext = {
        name: userSettings.name,
        position: userSettings.position,
        companyName: userSettings.companyName,
        city: userSettings.city,
        socialHandles: userSettings.socialHandles,
      };

      // Generate dynamic posts for this trend
      const { DynamicPostGenerationService } = await import(
        "../dynamicPostGeneration.service"
      );
      const dynamicPosts =
        await DynamicPostGenerationService.generateDynamicPosts(
          trend.description,
          trend.keypoints,
          userContext,
          userId,
          ["instagram", "facebook", "linkedin", "twitter", "tiktok", "youtube"]
        );

      // Update captions with dynamic content
      const updatedCaptions = {
        instagram_caption: this.getDynamicCaption(dynamicPosts, "instagram"),
        facebook_caption: this.getDynamicCaption(dynamicPosts, "facebook"),
        linkedin_caption: this.getDynamicCaption(dynamicPosts, "linkedin"),
        twitter_caption: this.getDynamicCaption(dynamicPosts, "twitter"),
        tiktok_caption: this.getDynamicCaption(dynamicPosts, "tiktok"),
        youtube_caption: this.getDynamicCaption(dynamicPosts, "youtube"),
        enhanced_with_dynamic_posts: true,
        caption_status: "ready",
        caption_processed_at: new Date(),
      };

      // Update the specific trend in the schedule
      await VideoSchedule.findByIdAndUpdate(scheduleId, {
        $set: {
          [`generatedTrends.${trendIndex}.instagram_caption`]:
            updatedCaptions.instagram_caption,
          [`generatedTrends.${trendIndex}.facebook_caption`]:
            updatedCaptions.facebook_caption,
          [`generatedTrends.${trendIndex}.linkedin_caption`]:
            updatedCaptions.linkedin_caption,
          [`generatedTrends.${trendIndex}.twitter_caption`]:
            updatedCaptions.twitter_caption,
          [`generatedTrends.${trendIndex}.tiktok_caption`]:
            updatedCaptions.tiktok_caption,
          [`generatedTrends.${trendIndex}.youtube_caption`]:
            updatedCaptions.youtube_caption,
          [`generatedTrends.${trendIndex}.enhanced_with_dynamic_posts`]:
            updatedCaptions.enhanced_with_dynamic_posts,
          [`generatedTrends.${trendIndex}.caption_status`]:
            updatedCaptions.caption_status,
          [`generatedTrends.${trendIndex}.caption_processed_at`]:
            updatedCaptions.caption_processed_at,
        },
      });

      console.log(
        `✅ Generated dynamic captions for trend ${trendIndex + 1}: "${
          trend.description
        }"`
      );
    } catch (error: any) {
      console.error(
        `❌ Failed to generate dynamic captions for trend ${trendIndex + 1}:`,
        error
      );

      // Mark as failed but continue processing others
      await VideoSchedule.findByIdAndUpdate(scheduleId, {
        $set: {
          [`generatedTrends.${trendIndex}.caption_status`]: "failed",
          [`generatedTrends.${trendIndex}.caption_error`]: error.message,
        },
      });
    }
  }

  /**
   * Queue background job to generate dynamic captions for remaining videos
   */
  static queueBackgroundCaptionGeneration(
    scheduleId: string,
    userId: string,
    userSettings: any
  ): void {
    console.log(
      `🚀 Queuing background caption generation for schedule ${scheduleId}`
    );

    // Start background processing immediately (non-blocking)
    setImmediate(async () => {
      try {
        console.log(
          `🔄 Starting background caption generation for schedule ${scheduleId}...`
        );
        await this.processBackgroundCaptions(scheduleId, userId, userSettings);
        console.log(
          `✅ Background caption generation completed for schedule ${scheduleId}`
        );
      } catch (error) {
        console.error(
          `❌ Background caption generation failed for schedule ${scheduleId}:`,
          error
        );
      }
    });

    console.log(
      `📋 Background caption generation queued for schedule ${scheduleId}`
    );
    console.log(`⏰ Enhanced captions will be available within 5-10 minutes`);
  }

  /**
   * Process background caption generation for pending videos
   */
  static async processBackgroundCaptions(
    scheduleId: string,
    userId: string,
    userSettings: any
  ): Promise<void> {
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    const pendingTrends = schedule.generatedTrends.filter(
      (trend: any) => trend.caption_status === "pending"
    );

    console.log(
      `📊 Found ${pendingTrends.length} videos pending caption generation`
    );

    for (let i = 0; i < pendingTrends.length; i++) {
      const trendIndex = schedule.generatedTrends.findIndex(
        (t: any) => t.description === pendingTrends[i].description
      );

      try {
        console.log(
          `🎯 Processing video ${i + 1}/${pendingTrends.length}: "${
            pendingTrends[i].description
          }"`
        );

        // Generate dynamic captions for this trend
        const userContext = {
          name: userSettings.name,
          position: userSettings.position,
          companyName: userSettings.companyName,
          city: userSettings.city,
          socialHandles: userSettings.socialHandles,
        };

        const { DynamicPostGenerationService } = await import(
          "../dynamicPostGeneration.service"
        );
        const dynamicPosts =
          await DynamicPostGenerationService.generateDynamicPosts(
            pendingTrends[i].description,
            pendingTrends[i].keypoints,
            userContext,
            userId,
            [
              "instagram",
              "facebook",
              "linkedin",
              "twitter",
              "tiktok",
              "youtube",
            ]
          );

        // Update trend with dynamic captions
        schedule.generatedTrends[trendIndex].instagram_caption =
          dynamicPosts.find((p) => p.platform === "instagram")?.content ||
          schedule.generatedTrends[trendIndex].instagram_caption;
        schedule.generatedTrends[trendIndex].facebook_caption =
          dynamicPosts.find((p) => p.platform === "facebook")?.content ||
          schedule.generatedTrends[trendIndex].facebook_caption;
        schedule.generatedTrends[trendIndex].linkedin_caption =
          dynamicPosts.find((p) => p.platform === "linkedin")?.content ||
          schedule.generatedTrends[trendIndex].linkedin_caption;
        schedule.generatedTrends[trendIndex].twitter_caption =
          dynamicPosts.find((p) => p.platform === "twitter")?.content ||
          schedule.generatedTrends[trendIndex].twitter_caption;
        schedule.generatedTrends[trendIndex].tiktok_caption =
          dynamicPosts.find((p) => p.platform === "tiktok")?.content ||
          schedule.generatedTrends[trendIndex].tiktok_caption;
        schedule.generatedTrends[trendIndex].youtube_caption =
          dynamicPosts.find((p) => p.platform === "youtube")?.content ||
          schedule.generatedTrends[trendIndex].youtube_caption;

        schedule.generatedTrends[trendIndex].enhanced_with_dynamic_posts = true;
        schedule.generatedTrends[trendIndex].caption_status = "ready";
        schedule.generatedTrends[trendIndex].caption_processed_at = new Date();

        // Save after each video to prevent data loss
        await schedule.save();

        console.log(
          `✅ Video ${i + 1}/${
            pendingTrends.length
          } captions generated and saved`
        );

        // Small delay between videos to avoid rate limiting
        if (i < pendingTrends.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(
          `❌ Failed to generate captions for video ${i + 1}:`,
          error
        );
        // Mark as failed but continue with other videos
        schedule.generatedTrends[trendIndex].caption_status = "failed";
        schedule.generatedTrends[trendIndex].caption_error =
          error instanceof Error ? error.message : "Unknown error";
        await schedule.save();
      }
    }

    console.log(
      `🎉 Background caption generation completed for schedule ${scheduleId}`
    );
  }

  /**
   * Get dynamic caption from generated posts
   */
  static getDynamicCaption(dynamicPosts: any[], platform: string): string {
    const post = dynamicPosts.find((p) => p.platform === platform);
    if (post && post.content) {
      return post.content;
    }

    // Fallback caption when dynamic generation fails
    console.warn(`⚠️ No dynamic caption found for ${platform}, using fallback`);
    return `Real Estate Update - Check out the latest market insights!`;
  }
}

