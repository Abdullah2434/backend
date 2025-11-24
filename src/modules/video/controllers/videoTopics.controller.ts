import { Request, Response } from "express";
import VideoService from "../services/video.service";
import {
  validateTopicParam,
  validateTopicIdParam,
} from "../../../validations/video.validations";
import { getErrorStatus } from "../../../utils/videoHelpers";

const videoService = new VideoService();

/**
 * Get all topics
 * GET /api/video/topics
 */
export async function getAllTopics(req: Request, res: Response) {
  try {
    const topics = await videoService.getAllTopics();

    return res.json({
      success: true,
      message: "Topics retrieved successfully",
      data: topics,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Get topic by type
 * GET /api/video/topics/:topic
 */
export async function getTopicByType(req: Request, res: Response) {
  try {
    const validationResult = validateTopicParam(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
      });
    }

    const { topic } = validationResult.data!;

    const topicData = await videoService.getTopicByType(topic);

    if (!topicData) {
      return res.status(404).json({
        success: false,
        message: "Topic not found",
      });
    }

    return res.json({
      success: true,
      message: "Topic retrieved successfully",
      data: topicData,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Get topic by ID
 * GET /api/video/topics/id/:id
 */
export async function getTopicById(req: Request, res: Response) {
  try {
    const validationResult = validateTopicIdParam(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
      });
    }

    const { id } = validationResult.data!;

    const topicData = await videoService.getTopicById(id);

    if (!topicData) {
      return res.status(404).json({
        success: false,
        message: "Topic not found",
      });
    }

    return res.json({
      success: true,
      message: "Topic retrieved successfully",
      data: topicData,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

