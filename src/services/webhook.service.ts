import { videoService } from "../modules/video/services/video.service";
import { VideoCompleteData, WebhookResult } from "../types";

export class WebhookService {
  /**
   * Handle video completion webhook
   */
  async handleVideoComplete(data: VideoCompleteData): Promise<WebhookResult> {
    const { videoId, status = "ready", s3Key, metadata, error } = data;

    if (!videoId) {
      throw new Error("Video ID is required");
    }

    // If there's an error, mark video as failed
    const finalStatus = error ? "failed" : status;

    // Update video status
    const updatedVideo = await videoService.updateVideoStatus(
      videoId,
      finalStatus as any
    );

    if (!updatedVideo) {
      throw new Error("Video not found");
    }

    // Update metadata if provided
    if (metadata) {
      await videoService.updateVideoMetadata(videoId, metadata);
    }

    // Update S3 key if provided (log for now)
    if (s3Key && s3Key !== updatedVideo.s3Key) {
      console.log(
        `Video complete webhook: S3 key updated for video ${videoId}`
      );
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
