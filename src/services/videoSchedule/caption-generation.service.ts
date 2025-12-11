import VideoSchedule from "../../models/VideoSchedule";
import {
  SOCIAL_MEDIA_PLATFORMS,
  CAPTION_BATCH_SIZE,
  BATCH_DELAY_MS,
  CAPTION_STATUS_PENDING,
  CAPTION_STATUS_READY,
  CAPTION_STATUS_FAILED,
  STATUS_FAILED,
  STATUS_READY,
  STATUS_PROCESSING,
} from "../../constants/videoScheduleService.constants";
import { UserContext } from "../../types/videoScheduleService.types";
import {
  getDynamicCaption,
  buildCaptionUpdateObject,
} from "../../utils/videoScheduleServiceHelpers";
import { truncateSocialMediaCaptions } from "../../utils/captionTruncationHelpers";

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
        const userContext: UserContext = {
          name: userSettings.name,
          position: userSettings.position,
          companyName: userSettings.companyName,
          city: userSettings.city,
          socialHandles: userSettings.socialHandles,
        };

        // Generate dynamic posts for this trend
        const { DynamicPostGenerationService } = await import(
          "../content"
        );
        const dynamicPosts =
          await DynamicPostGenerationService.generateDynamicPosts(
            trend.description,
            trend.keypoints,
            userContext,
            userId,
            [...SOCIAL_MEDIA_PLATFORMS],
            userSettings.language
          );

        // Create enhanced trend with dynamic captions
        const rawCaptions = {
          instagram_caption: getDynamicCaption(dynamicPosts, "instagram"),
          facebook_caption: getDynamicCaption(dynamicPosts, "facebook"),
          linkedin_caption: getDynamicCaption(dynamicPosts, "linkedin"),
          twitter_caption: getDynamicCaption(dynamicPosts, "twitter"),
          tiktok_caption: getDynamicCaption(dynamicPosts, "tiktok"),
          youtube_caption: getDynamicCaption(dynamicPosts, "youtube"),
        };

        // Truncate captions to platform-specific limits
        const truncatedCaptions = truncateSocialMediaCaptions(rawCaptions);

        const enhancedTrend = {
          ...trend,
          ...truncatedCaptions,
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
          status: STATUS_FAILED,
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

    // Process videos in batches to avoid rate limiting
    const batchSize = CAPTION_BATCH_SIZE;
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
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      } catch (error: any) {
      
        // Continue with next batch
      }
    }

    // Update schedule status to ready
    await VideoSchedule.findByIdAndUpdate(scheduleId, {
      status: STATUS_READY,
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
      const userContext: UserContext = {
        name: userSettings.name,
        position: userSettings.position,
        companyName: userSettings.companyName,
        city: userSettings.city,
        socialHandles: userSettings.socialHandles,
      };

      // Generate dynamic posts for this trend
      const { DynamicPostGenerationService } = await import(
        "../content"
      );
      const dynamicPosts =
        await DynamicPostGenerationService.generateDynamicPosts(
          trend.description,
          trend.keypoints,
          userContext,
          userId,
          [...SOCIAL_MEDIA_PLATFORMS],
          userSettings.language
        );

      // Update captions with dynamic content
      const rawCaptions = {
        instagram_caption: getDynamicCaption(dynamicPosts, "instagram"),
        facebook_caption: getDynamicCaption(dynamicPosts, "facebook"),
        linkedin_caption: getDynamicCaption(dynamicPosts, "linkedin"),
        twitter_caption: getDynamicCaption(dynamicPosts, "twitter"),
        tiktok_caption: getDynamicCaption(dynamicPosts, "tiktok"),
        youtube_caption: getDynamicCaption(dynamicPosts, "youtube"),
      };

      // Truncate captions to platform-specific limits
      const truncatedCaptions = truncateSocialMediaCaptions(rawCaptions);

      // Ensure all captions are strings (not undefined) for buildCaptionUpdateObject
      const captionsForUpdate = {
        instagram_caption: truncatedCaptions.instagram_caption || "",
        facebook_caption: truncatedCaptions.facebook_caption || "",
        linkedin_caption: truncatedCaptions.linkedin_caption || "",
        twitter_caption: truncatedCaptions.twitter_caption || "",
        tiktok_caption: truncatedCaptions.tiktok_caption || "",
        youtube_caption: truncatedCaptions.youtube_caption || "",
      };

      // Update the specific trend in the schedule using helper function
      const updateObject = buildCaptionUpdateObject(trendIndex, captionsForUpdate);
      updateObject[`generatedTrends.${trendIndex}.caption_processed_at`] =
        new Date();

      await VideoSchedule.findByIdAndUpdate(scheduleId, {
        $set: updateObject,
      });

    } catch (error: any) {
    

      // Mark as failed but continue processing others
      await VideoSchedule.findByIdAndUpdate(scheduleId, {
        $set: {
          [`generatedTrends.${trendIndex}.caption_status`]: CAPTION_STATUS_FAILED,
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
      (trend: any) => trend.caption_status === CAPTION_STATUS_PENDING
    );


    for (let i = 0; i < pendingTrends.length; i++) {
      const trendIndex = schedule.generatedTrends.findIndex(
        (t: any) => t.description === pendingTrends[i].description
      );

      try {
   

        // Generate dynamic captions for this trend
        const userContext: UserContext = {
          name: userSettings.name,
          position: userSettings.position,
          companyName: userSettings.companyName,
          city: userSettings.city,
          socialHandles: userSettings.socialHandles,
        };

        const { DynamicPostGenerationService } = await import(
          "../content"
        );
        const dynamicPosts =
          await DynamicPostGenerationService.generateDynamicPosts(
            pendingTrends[i].description,
            pendingTrends[i].keypoints,
            userContext,
            userId,
            [...SOCIAL_MEDIA_PLATFORMS],
            userSettings.language
          );

        // Update trend with dynamic captions using helper function
        const rawCaptions = {
          instagram_caption: getDynamicCaption(dynamicPosts, "instagram") || "",
          facebook_caption: getDynamicCaption(dynamicPosts, "facebook") || "",
          linkedin_caption: getDynamicCaption(dynamicPosts, "linkedin") || "",
          twitter_caption: getDynamicCaption(dynamicPosts, "twitter") || "",
          tiktok_caption: getDynamicCaption(dynamicPosts, "tiktok") || "",
          youtube_caption: getDynamicCaption(dynamicPosts, "youtube") || "",
        };

        // Truncate captions to platform-specific limits
        const truncatedCaptions = truncateSocialMediaCaptions(rawCaptions);

        const trend = schedule.generatedTrends[trendIndex];
        trend.instagram_caption =
          truncatedCaptions.instagram_caption || trend.instagram_caption;
        trend.facebook_caption =
          truncatedCaptions.facebook_caption || trend.facebook_caption;
        trend.linkedin_caption =
          truncatedCaptions.linkedin_caption || trend.linkedin_caption;
        trend.twitter_caption =
          truncatedCaptions.twitter_caption || trend.twitter_caption;
        trend.tiktok_caption =
          getDynamicCaption(dynamicPosts, "tiktok") || trend.tiktok_caption;
        trend.youtube_caption =
          getDynamicCaption(dynamicPosts, "youtube") || trend.youtube_caption;

        trend.enhanced_with_dynamic_posts = true;
        trend.caption_status = CAPTION_STATUS_READY;
        trend.caption_processed_at = new Date();

        // Save after each video to prevent data loss
        await schedule.save();

        // Small delay between videos to avoid rate limiting
        if (i < pendingTrends.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      } catch (error) {
      
        // Mark as failed but continue with other videos
        schedule.generatedTrends[trendIndex].caption_status = CAPTION_STATUS_FAILED;
        schedule.generatedTrends[trendIndex].caption_error =
          error instanceof Error ? error.message : "Unknown error";
        await schedule.save();
      }
    }


  }

  /**
   * Get dynamic caption from generated posts
   * @deprecated Use getDynamicCaption from utils/videoScheduleServiceHelpers instead
   */
  static getDynamicCaption(dynamicPosts: any[], platform: string): string {
    return getDynamicCaption(dynamicPosts, platform);
  }
}

