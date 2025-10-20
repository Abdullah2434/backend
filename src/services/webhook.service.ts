import VideoService from "./video.service";
import { VideoCompleteData, WebhookResult } from "../types";
import VideoScheduleService from "./videoSchedule.service";
import AutoSocialPostingService from "./autoSocialPosting.service";

export class WebhookService {
  private videoService: VideoService;
  private videoScheduleService: VideoScheduleService;
  private autoSocialPostingService: AutoSocialPostingService;

  constructor() {
    this.videoService = new VideoService();
    this.videoScheduleService = new VideoScheduleService();
    this.autoSocialPostingService = new AutoSocialPostingService();
  }

  /**
   * Handle video completion webhook
   */
  async handleVideoComplete(data: VideoCompleteData): Promise<WebhookResult> {
    const {
      videoId,
      status = "ready",
      s3Key,
      metadata,
      error,
      scheduleId,
      trendIndex,
      captions,
    } = data;

    if (!videoId) {
      throw new Error("Video ID is required");
    }

    // If there's an error, mark video as failed
    const finalStatus = error ? "failed" : status;

    // Update video status
    const updatedVideo = await this.videoService.updateVideoStatus(
      videoId,
      finalStatus as any
    );

    if (!updatedVideo) {
      throw new Error("Video not found");
    }

    // Update metadata if provided
    if (metadata) {
      await this.videoService.updateVideoMetadata(videoId, metadata);
    }

    // Update S3 key if provided (log for now)
    if (s3Key && s3Key !== updatedVideo.s3Key) {
      console.log(
        `Video complete webhook: S3 key updated for video ${videoId}`
      );
    }

    // Handle scheduled video completion
    if (scheduleId && trendIndex !== undefined) {
      console.log(
        `🎬 Processing scheduled video completion: ${videoId} for schedule ${scheduleId}, trend ${trendIndex}`
      );

      // Update schedule status
      await this.videoScheduleService.updateVideoStatus(
        scheduleId,
        trendIndex,
        finalStatus as "completed" | "failed",
        videoId
      );

      // If video is completed, store captions and auto-post
      if (finalStatus === "ready" && updatedVideo) {
        try {
          // Get the schedule to retrieve captions
          const VideoSchedule = require("../models/VideoSchedule").default;
          const schedule = await VideoSchedule.findById(scheduleId);

          if (schedule && schedule.generatedTrends[trendIndex]) {
            const trend = schedule.generatedTrends[trendIndex];

            // Use existing captions from schedule instead of generating new ones
            console.log("📋 Using existing captions from schedule database...");
            console.log("📋 Available captions in schedule:");
            console.log(
              `  📱 Instagram: ${
                trend.instagram_caption ? "Available" : "Missing"
              }`
            );
            console.log(
              `  📱 Facebook: ${
                trend.facebook_caption ? "Available" : "Missing"
              }`
            );
            console.log(
              `  📱 LinkedIn: ${
                trend.linkedin_caption ? "Available" : "Missing"
              }`
            );
            console.log(
              `  📱 Twitter: ${trend.twitter_caption ? "Available" : "Missing"}`
            );
            console.log(
              `  📱 TikTok: ${trend.tiktok_caption ? "Available" : "Missing"}`
            );
            console.log(
              `  📱 YouTube: ${trend.youtube_caption ? "Available" : "Missing"}`
            );

            // Store captions from schedule in video record
            const captionsFromSchedule = {
              instagram_caption: trend.instagram_caption,
              facebook_caption: trend.facebook_caption,
              linkedin_caption: trend.linkedin_caption,
              twitter_caption: trend.twitter_caption,
              tiktok_caption: trend.tiktok_caption,
              youtube_caption: trend.youtube_caption,
            };

            await this.videoService.updateVideoCaptions(
              videoId,
              captionsFromSchedule
            );
            console.log(
              `✅ Captions from schedule stored for video ${videoId}`
            );

            // Auto post to social media platforms
            try {
              console.log(
                `🚀 Starting auto social media posting for scheduled video ${videoId}`
              );
              console.log(`📋 Video URL: ${updatedVideo.videoUrl}`);
              console.log(`📋 Video Title: ${trend.description}`);
              console.log(`📋 User ID: ${schedule.userId}`);
              console.log(`📋 Schedule ID: ${scheduleId}`);
              console.log(`📋 Trend Index: ${trendIndex}`);

              const postingResults =
                await this.autoSocialPostingService.postVideoToSocialMedia({
                  userId: schedule.userId.toString(),
                  scheduleId: scheduleId,
                  trendIndex: trendIndex,
                  videoUrl: updatedVideo.videoUrl,
                  videoTitle: trend.description,
                });

              console.log(`📱 Auto social posting results:`, postingResults);

              // Log posting results
              const successfulPosts = postingResults.filter((r) => r.success);
              const failedPosts = postingResults.filter((r) => !r.success);

              if (successfulPosts.length > 0) {
                console.log(
                  `✅ Successfully posted to ${successfulPosts.length} platforms:`,
                  successfulPosts.map((r) => r.accountName).join(", ")
                );
              }

              if (failedPosts.length > 0) {
                console.log(
                  `❌ Failed to post to ${failedPosts.length} platforms:`,
                  failedPosts
                    .map((r) => `${r.accountName} (${r.error})`)
                    .join(", ")
                );
              }
            } catch (postingError) {
              console.error(
                `❌ Error in auto social media posting for video ${videoId}:`,
                postingError
              );
              // Don't fail the webhook if social posting fails
            }
          }
        } catch (captionError) {
          console.error(
            `❌ Error storing captions for video ${videoId}:`,
            captionError
          );
          // Don't fail the webhook if caption storage fails
        }
      }
    }

    // Handle custom video completion - auto-generate dynamic captions
    if (
      finalStatus === "ready" &&
      updatedVideo &&
      !scheduleId && // Only for custom videos (not scheduled)
      !updatedVideo.socialMediaCaptions
    ) {
      try {
        console.log(
          `🎨 Auto-generating dynamic captions for custom video ${videoId}`
        );

        // Trigger dynamic caption generation
        await this.videoService.onVideoCompleted(videoId);

        console.log(
          `✅ Dynamic captions generated for custom video ${videoId}`
        );
      } catch (captionError) {
        console.error(
          `❌ Error generating dynamic captions for custom video ${videoId}:`,
          captionError
        );
        // Don't fail the webhook if caption generation fails
      }
    }

    // Handle custom video completion - store provided captions if available
    if (
      finalStatus === "ready" &&
      updatedVideo &&
      captions &&
      !updatedVideo.socialMediaCaptions
    ) {
      try {
        await this.videoService.updateVideoCaptions(videoId, captions);
        console.log(`✅ Provided captions stored for custom video ${videoId}`);
      } catch (captionError) {
        console.error(
          `❌ Error storing provided captions for custom video ${videoId}:`,
          captionError
        );
        // Don't fail the webhook if caption storage fails
      }
    }

    return {
      success: true,
      message: `Video ${
        finalStatus === "ready" ? "completed" : "failed"
      } successfully`,
      data: {
        videoId,
        status: finalStatus,
      },
    };
  }
}

export default WebhookService;
