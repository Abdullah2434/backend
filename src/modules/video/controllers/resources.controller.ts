import { Request, Response } from "express";
import { authService } from "../../auth/services/auth.service";
import { videoService } from "../services/video.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Get available avatars (public + user's custom if authenticated)
 */
export const getAvatars = asyncHandler(async (req: Request, res: Response) => {
  let userId: string | undefined;

  // Try to get user if token is provided (optional authentication)
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    const user = await authService.getCurrentUser(token);
    if (user) {
      userId = user._id.toString();
    }
  }

  const avatars = await videoService.getAvatars(userId);

  return res.json({
    success: true,
    custom: avatars.custom,
    default: avatars.default,
  });
});

/**
 * Get available voices (public + user's custom if authenticated)
 */
export const getVoices = asyncHandler(async (req: Request, res: Response) => {
  let userId: string | undefined;

  // Try to get user if token is provided (optional authentication)
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    const user = await authService.getCurrentUser(token);
    if (user) {
      userId = user._id.toString();
    }
  }

  const voices = await videoService.getVoices(userId);

  return res.json({
    success: true,
    custom: voices.custom,
    default: voices.default,
  });
});

/**
 * Get all topics
 */
export const getAllTopics = asyncHandler(
  async (req: Request, res: Response) => {
    const topics = await videoService.getAllTopics();

    return ResponseHelper.success(res, "Topics retrieved successfully", topics);
  }
);

/**
 * Get topic by type
 */
export const getTopicByType = asyncHandler(
  async (req: Request, res: Response) => {
    const { topic } = req.params;

    if (!topic) {
      return ResponseHelper.badRequest(res, "Topic parameter is required");
    }

    const topicData = await videoService.getTopicByType(topic);

    if (!topicData) {
      return ResponseHelper.notFound(res, "Topic not found");
    }

    return ResponseHelper.success(
      res,
      "Topic retrieved successfully",
      topicData
    );
  }
);

/**
 * Get topic by ID
 */
export const getTopicById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return ResponseHelper.badRequest(res, "ID parameter is required");
    }

    const topicData = await videoService.getTopicById(id);

    if (!topicData) {
      return ResponseHelper.notFound(res, "Topic not found");
    }

    return ResponseHelper.success(
      res,
      "Topic retrieved successfully",
      topicData
    );
  }
);
