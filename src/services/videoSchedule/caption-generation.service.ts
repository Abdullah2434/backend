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
  
      } catch (error) {
     
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
 
    setImmediate(async () => {
      try {
        await this.processAllBackgroundCaptions(
          scheduleId,
          userId,
          userSettings,
          totalVideos
        );
      } catch (error: any) {


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

    // Process videos in batches of 3 to avoid rate limiting
    const batchSize = 3;
    const totalBatches = Math.ceil(totalVideos / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalVideos);

  

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

    } catch (error: any) {
    

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


    // Start background processing immediately (non-blocking)
    setImmediate(async () => {
      try {
   
        await this.processBackgroundCaptions(scheduleId, userId, userSettings);
    
      } catch (error) {
   
      }
    });

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


    for (let i = 0; i < pendingTrends.length; i++) {
      const trendIndex = schedule.generatedTrends.findIndex(
        (t: any) => t.description === pendingTrends[i].description
      );

      try {
   

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

        // Small delay between videos to avoid rate limiting
        if (i < pendingTrends.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
      
        // Mark as failed but continue with other videos
        schedule.generatedTrends[trendIndex].caption_status = "failed";
        schedule.generatedTrends[trendIndex].caption_error =
          error instanceof Error ? error.message : "Unknown error";
        await schedule.save();
      }
    }


  }

  /**
   * Get dynamic caption from generated posts
   */
  static getDynamicCaption(dynamicPosts: any[], platform: string): string {
    const post = dynamicPosts.find((p) => p.platform === platform);
    if (post && post.content) {
      return post.content;
    }

    return `Real Estate Update - Check out the latest market insights!`;
  }
}

