import { Request, Response } from "express";
import { socialBuMediaService } from "../services/media.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Upload media to SocialBu
 */
export const uploadMedia = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return ResponseHelper.unauthorized(res, "User ID is required");
  }

  const { videoUrl, videoName, mimeType } = req.body;

  if (!videoUrl || !videoName) {
    return ResponseHelper.badRequest(
      res,
      "videoUrl and videoName are required"
    );
  }

  const result = await socialBuMediaService.uploadMedia(userId, {
    videoUrl,
    videoName,
    mimeType: mimeType || "video/mp4",
  });

  if (!result.success) {
    return ResponseHelper.badRequest(res, result.message, result.error);
  }

  return ResponseHelper.success(res, result.message, result.data);
});

/**
 * Get upload status for a specific media
 */
export const getUploadStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return ResponseHelper.unauthorized(res, "User ID is required");
    }

    const { mediaId } = req.params;

    if (!mediaId) {
      return ResponseHelper.badRequest(res, "Media ID is required");
    }

    const status = await socialBuMediaService.getUploadStatus(userId, mediaId);

    if (!status) {
      return ResponseHelper.notFound(res, "Media not found");
    }

    return ResponseHelper.success(
      res,
      "Upload status retrieved successfully",
      status
    );
  }
);

/**
 * Get all media uploads for authenticated user
 */
export const getUserMedia = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return ResponseHelper.unauthorized(res, "User ID is required");
    }

    const media = await socialBuMediaService.getUserMedia(userId);

    return ResponseHelper.success(
      res,
      "User media retrieved successfully",
      media
    );
  }
);

/**
 * Get active uploads
 */
export const getActiveUploads = asyncHandler(
  async (req: Request, res: Response) => {
    const uploads = await socialBuMediaService.getActiveUploads();

    return ResponseHelper.success(
      res,
      "Active uploads retrieved successfully",
      uploads
    );
  }
);
