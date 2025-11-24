import { Request, Response } from "express";
import VideoService from "../services/video.service";
import {
  requireAuth,
  getCurrentUser,
  formatVideoResponse,
  getErrorStatus,
} from "../../../utils/videoHelpers";

const videoService = new VideoService();

/**
 * Get user's video gallery
 * GET /api/video/gallery
 */
export async function gallery(req: Request, res: Response) {
  try {
    requireAuth(req);
    const user = await getCurrentUser(req);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired access token" });
    }

    const videosWithUrls = await videoService.getUserVideosWithDownloadUrls(
      user._id.toString()
    );
    const stats = await videoService.getUserVideoStats(user._id.toString());

    const formattedVideos = videosWithUrls.map((video: any) =>
      formatVideoResponse(video)
    );

    return res.json({
      success: true,
      message: "Video gallery retrieved successfully",
      data: {
        videos: formattedVideos,
        totalCount: stats.totalCount,
        readyCount: stats.readyCount,
        processingCount: stats.processingCount,
        failedCount: stats.failedCount,
      },
    });
  } catch (e: any) {
    const status = getErrorStatus(e);
    return res
      .status(status)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

