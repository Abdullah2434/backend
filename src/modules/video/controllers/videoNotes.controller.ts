import { Request, Response } from "express";
import VideoService from "../services/video.service";
import {
  validateVideoIdParam,
  validateUpdateVideoNote,
} from "../../../validations/video.validations";
import { requireAuth, getErrorStatus } from "../../../utils/videoHelpers";

const videoService = new VideoService();

/**
 * Update video note
 * PUT /api/video/:videoId/note
 */
export async function updateVideoNote(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);

    // Validate videoId parameter
    const videoIdValidation = validateVideoIdParam(req.params);
    if (!videoIdValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: videoIdValidation.errors,
      });
    }

    // Validate request body
    const validationResult = validateUpdateVideoNote(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
      });
    }

    const { videoId } = videoIdValidation.data!;
    const { note } = validationResult.data!;

    // Get video to verify ownership
    const video = await videoService.getVideo(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // Verify video belongs to user
    if (video.userId && video.userId.toString() !== payload.userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to update this video",
      });
    }

    // Update video note
    const updatedVideo = await videoService.updateVideoNote(
      videoId,
      note ?? null
    );

    if (!updatedVideo) {
      return res.status(500).json({
        success: false,
        message: "Failed to update video note",
      });
    }

    return res.json({
      success: true,
      message: "Video note updated successfully",
      data: {
        videoId: updatedVideo.videoId,
        note: updatedVideo.note,
        updatedAt: updatedVideo.updatedAt,
      },
    });
  } catch (e: any) {
    const status = getErrorStatus(e);
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

