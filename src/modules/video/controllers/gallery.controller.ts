import { Request, Response } from "express";
import { authService } from "../../auth/services/auth.service";
import { tokenService } from "../../auth/services/token.service";
import { videoService } from "../services/video.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Get user's video gallery
 */
export const getGallery = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");

  if (!token) {
    return ResponseHelper.unauthorized(res, "Access token is required");
  }

  const payload = tokenService.verifyToken(token);
  if (!payload) {
    return ResponseHelper.unauthorized(res, "Invalid or expired access token");
  }

  const user = await authService.getCurrentUser(token);
  if (!user) {
    return ResponseHelper.unauthorized(res, "Invalid or expired access token");
  }

  const videosWithUrls = await videoService.getUserVideosWithDownloadUrls(
    user._id.toString()
  );
  const stats = await videoService.getUserVideoStats(user._id.toString());

  const formattedVideos = videosWithUrls.map((video: any) => ({
    id: video._id.toString(),
    videoId: video.videoId,
    title: video.title,
    status: video.status,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
    metadata: video.metadata,
    downloadUrl: video.downloadUrl || null,
    videoUrl: video.videoUrl || null,
  }));

  return ResponseHelper.success(res, "Video gallery retrieved successfully", {
    videos: formattedVideos,
    totalCount: stats.totalCount,
    readyCount: stats.readyCount,
    processingCount: stats.processingCount,
    failedCount: stats.failedCount,
  });
});

/**
 * Update video status
 */
export const updateVideoStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { videoId, status, metadata } = req.body;

    if (!videoId || !status) {
      return ResponseHelper.badRequest(res, "Video ID and status are required");
    }

    if (!["processing", "ready", "failed"].includes(status)) {
      return ResponseHelper.badRequest(
        res,
        "Invalid status. Must be processing, ready, or failed"
      );
    }

    const updatedVideo = await videoService.updateVideoStatus(videoId, status);

    if (!updatedVideo) {
      return ResponseHelper.notFound(res, "Video not found");
    }

    // Update metadata if provided
    if (metadata) {
      await videoService.updateVideoMetadata(videoId, metadata);
    }

    return ResponseHelper.success(res, "Video status updated successfully", {
      videoId: updatedVideo.videoId,
      status: updatedVideo.status,
      updatedAt: updatedVideo.updatedAt,
    });
  }
);

/**
 * Delete a video
 */
export const deleteVideo = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");

  if (!token) {
    return ResponseHelper.unauthorized(res, "Access token is required");
  }

  const payload = tokenService.verifyToken(token);
  if (!payload) {
    return ResponseHelper.unauthorized(res, "Invalid or expired access token");
  }

  const { videoId } = req.body;

  if (!videoId) {
    return ResponseHelper.badRequest(res, "Video ID is required");
  }

  const video = await videoService.getVideo(videoId);
  if (!video) {
    return ResponseHelper.notFound(res, "Video not found");
  }

  // Verify video belongs to user
  if (video.userId && video.userId.toString() !== payload.userId) {
    return ResponseHelper.forbidden(res, "Unauthorized to delete this video");
  }

  const deleted = await videoService.deleteVideo(videoId);

  if (!deleted) {
    return ResponseHelper.internalError(res, "Failed to delete video");
  }

  return ResponseHelper.success(res, "Video deleted successfully");
});

/**
 * Download video proxy
 */
export const downloadVideoProxy = asyncHandler(
  async (req: Request, res: Response) => {
    const videoUrl = String(req.query.url || "");

    if (!videoUrl) {
      return ResponseHelper.badRequest(res, "Video URL is required");
    }

    // Fetch the video from S3 (server-side, no CORS issues)
    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.status}`);
    }

    // Get video data
    const videoBuffer = await videoResponse.arrayBuffer();
    const contentType =
      videoResponse.headers.get("content-type") || "video/mp4";

    // Return the video as a downloadable file
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", 'attachment; filename="video.mp4"');
    res.setHeader("Content-Length", videoBuffer.byteLength.toString());
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");

    return res.status(200).send(Buffer.from(videoBuffer));
  }
);
