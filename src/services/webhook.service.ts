import VideoService from "./video.service";
import { VideoCompleteData, WebhookResult } from "../types";
import VideoScheduleService from "./videoSchedule.service";

export class WebhookService {
  private videoService: VideoService;
  private videoScheduleService: VideoScheduleService;

  constructor() {
    this.videoService = new VideoService();
    this.videoScheduleService = new VideoScheduleService();
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

      // If video is completed, store captions in Video model
      if (finalStatus === "ready" && updatedVideo) {
        try {
          // Get the schedule to retrieve captions
          const VideoSchedule = require("../models/VideoSchedule").default;
          const schedule = await VideoSchedule.findById(scheduleId);

          if (schedule && schedule.generatedTrends[trendIndex]) {
            const trend = schedule.generatedTrends[trendIndex];

            // Generate captions if not already stored
            if (!updatedVideo.socialMediaCaptions) {
              const CaptionGenerationService =
                require("./captionGeneration.service").default;
              const UserVideoSettings =
                require("../models/UserVideoSettings").default;

              const userSettings = await UserVideoSettings.findOne({
                userId: schedule.userId,
              });

              if (userSettings) {
                const captions =
                  await CaptionGenerationService.generateScheduledVideoCaptions(
                    trend.description,
                    trend.keypoints,
                    {
                      name: userSettings.name,
                      position: userSettings.position,
                      companyName: userSettings.companyName,
                      city: userSettings.city,
                      socialHandles: userSettings.socialHandles,
                    }
                  );

                // Update video with captions
                await this.videoService.updateVideoCaptions(videoId, captions);
                console.log(
                  `✅ Captions stored for scheduled video ${videoId}`
                );
              }
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

    // Handle custom video completion - store captions if provided
    if (
      finalStatus === "ready" &&
      updatedVideo &&
      captions &&
      !updatedVideo.socialMediaCaptions
    ) {
      try {
        await this.videoService.updateVideoCaptions(videoId, captions);
        console.log(`✅ Captions stored for custom video ${videoId}`);
      } catch (captionError) {
        console.error(
          `❌ Error storing captions for custom video ${videoId}:`,
          captionError
        );
        // Don't fail the webhook if caption storage fails
      }
    }

    console.log(
      `Video complete webhook: Successfully updated video ${videoId} to status ${finalStatus}`
    );

    return {
      success: true,
      message: "Video status updated successfully",
      data: {
        videoId: updatedVideo.videoId,
        status: updatedVideo.status,
        updatedAt: updatedVideo.updatedAt,
      },
    };
  }
}

export default WebhookService;
