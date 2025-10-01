import { Response } from "express";
import VideoModuleService from "../services/video.service";
import { VideoResponse } from "../types/video.types";
import { logVideoError } from "../utils/video.utils";

const videoService = new VideoModuleService();

const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: any
): void => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data,
  });
};

export const gallery = async (req: any, res: Response): Promise<void> => {
  try {
    const result = await videoService.getUserVideos(req.user!._id);
    sendResponse(res, 200, "Video gallery retrieved successfully", result);
  } catch (error: any) {
    logVideoError(error, { userId: req.user?._id, action: "gallery" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve video gallery"
    );
  }
};

export const deleteVideo = async (req: any, res: Response): Promise<void> => {
  try {
    await videoService.deleteVideo(req.body.videoId, req.user!._id);
    sendResponse(res, 200, "Video deleted successfully");
  } catch (error: any) {
    logVideoError(error, {
      videoId: req.body.videoId,
      userId: req.user?._id,
      action: "deleteVideo",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to delete video"
    );
  }
};

export const download = async (req: any, res: Response): Promise<void> => {
  try {
    const result = await videoService.downloadVideo(req.body);
    sendResponse(
      res,
      200,
      "Video downloaded and uploaded successfully",
      result
    );
  } catch (error: any) {
    logVideoError(error, { downloadData: req.body, action: "download" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to download video"
    );
  }
};

export const updateStatus = async (req: any, res: Response): Promise<void> => {
  try {
    const result = await videoService.updateVideoStatus(req.body);
    sendResponse(res, 200, "Video status updated successfully", result);
  } catch (error: any) {
    logVideoError(error, { statusData: req.body, action: "updateStatus" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to update video status"
    );
  }
};

export const createVideo = async (req: any, res: Response): Promise<void> => {
  try {
    const result = await videoService.createVideo(req.body);
    sendResponse(
      res,
      200,
      "Video creation request submitted successfully",
      result
    );
  } catch (error: any) {
    logVideoError(error, { creationData: req.body, action: "createVideo" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to create video"
    );
  }
};

export const generateVideo = async (req: any, res: Response): Promise<void> => {
  try {
    const result = await videoService.generateVideo(req.body);
    sendResponse(res, 200, "Video generation started successfully", result);
  } catch (error: any) {
    logVideoError(error, { generationData: req.body, action: "generateVideo" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to generate video"
    );
  }
};

export const downloadProxy = async (req: any, res: Response): Promise<void> => {
  try {
    const videoUrl = String(req.query.url || "");
    if (!videoUrl) {
      sendResponse(res, 400, "Video URL is required");
      return;
    }

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      sendResponse(res, 500, `Failed to fetch video: ${videoResponse.status}`);
      return;
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const contentType =
      videoResponse.headers.get("content-type") || "video/mp4";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", 'attachment; filename="video.mp4"');
    res.setHeader("Content-Length", videoBuffer.byteLength.toString());
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");

    res.status(200).send(Buffer.from(videoBuffer));
  } catch (error: any) {
    logVideoError(error, { videoUrl: req.query.url, action: "downloadProxy" });
    sendResponse(res, 500, error.message || "Failed to proxy video download");
  }
};

export const getAvatars = async (req: any, res: Response): Promise<void> => {
  try {
    const result = await videoService.getUserAvatars(req.user!._id);
    sendResponse(res, 200, "Avatars retrieved successfully", result);
  } catch (error: any) {
    logVideoError(error, { userId: req.user?._id, action: "getAvatars" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve avatars"
    );
  }
};

export const getVoices = async (req: any, res: Response): Promise<void> => {
  try {
    const result = await videoService.getUserVoices(req.user!._id);
    sendResponse(res, 200, "Voices retrieved successfully", result);
  } catch (error: any) {
    logVideoError(error, { userId: req.user?._id, action: "getVoices" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve voices"
    );
  }
};

export const createPhotoAvatar = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    if (!req.file) {
      sendResponse(res, 400, "Image file is required");
      return;
    }

    await videoService.createPhotoAvatar({
      ...req.body,
      imagePath: req.file.path,
      mimeType: req.file.mimetype,
    });

    sendResponse(
      res,
      200,
      "Photo avatar creation started. You will be notified when ready."
    );
  } catch (error: any) {
    logVideoError(error, { avatarData: req.body, action: "createPhotoAvatar" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to create photo avatar"
    );
  }
};

export const checkPendingWorkflows = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const result = await videoService.checkPendingWorkflows(req.params.userId);
    sendResponse(
      res,
      200,
      result.hasPendingWorkflows
        ? "Pending workflows found"
        : "No pending workflows found",
      result
    );
  } catch (error: any) {
    logVideoError(error, {
      userId: req.params.userId,
      action: "checkPendingWorkflows",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to check pending workflows"
    );
  }
};

export const trackExecution = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const result = await videoService.trackExecution(
      req.body.executionId,
      req.body.email
    );
    sendResponse(res, 200, "Execution tracked successfully", result);
  } catch (error: any) {
    logVideoError(error, { executionData: req.body, action: "trackExecution" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to track execution"
    );
  }
};

export const getAllTopics = async (req: any, res: Response): Promise<void> => {
  try {
    const topics = await videoService.getAllTopics();
    sendResponse(res, 200, "Topics retrieved successfully", topics);
  } catch (error: any) {
    logVideoError(error, { action: "getAllTopics" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve topics"
    );
  }
};

export const getTopicByType = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const topicData = await videoService.getTopicByType(req.params.topic);
    sendResponse(res, 200, "Topic retrieved successfully", topicData);
  } catch (error: any) {
    logVideoError(error, { topic: req.params.topic, action: "getTopicByType" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve topic"
    );
  }
};

export const getTopicById = async (req: any, res: Response): Promise<void> => {
  try {
    const topicData = await videoService.getTopicById(req.params.id);
    sendResponse(res, 200, "Topic retrieved successfully", topicData);
  } catch (error: any) {
    logVideoError(error, { id: req.params.id, action: "getTopicById" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve topic"
    );
  }
};
