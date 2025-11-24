import { Request, Response } from "express";
import VideoService from "../services/video.service";
import {
  validateDeleteVideo,
  validateVideoIdParam,
} from "../../../validations/video.validations";
import { requireAuth, getErrorStatus } from "../../../utils/videoHelpers";

const videoService = new VideoService();

/**
 * Delete a video (legacy endpoint)
 * POST /api/video/delete
 */
export async function deleteVideo(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const validationResult = validateDeleteVideo(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
      });
    }

    const { videoId } = validationResult.data!;

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
        message: "Unauthorized to delete this video",
      });
    }

    const deleted = await videoService.deleteVideo(videoId);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete video",
      });
    }

    return res.json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (e: any) {
    const status = getErrorStatus(e);
    return res
      .status(status)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

/**
 * Delete a video by ID (RESTful DELETE endpoint)
 * DELETE /api/video/:videoId
 */
export async function deleteVideoById(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const validationResult = validateVideoIdParam(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
      });
    }

    const { videoId } = validationResult.data!;

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
        message: "Unauthorized to delete this video",
      });
    }

    // Delete video from S3 and database
    const deleted = await videoService.deleteVideo(videoId);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete video",
      });
    }

    return res.json({
      success: true,
      message: "Video deleted successfully",
      data: {
        videoId: videoId,
        deletedAt: new Date().toISOString(),
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

