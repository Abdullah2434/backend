import mongoose from "mongoose";
import DefaultAvatar from "../../../models/avatar";
import DefaultVoice from "../../../models/voice";
import WorkflowHistory from "../../../models/WorkflowHistory";
import { addPhotoAvatarJob } from "../../../modules/queue";
import { notificationService } from "../../../modules/notification";
import Topic from "../../../models/Topic";
import User from "../../../models/User";
import {
  PhotoAvatarData,
  VideoError,
  NotFoundError,
} from "../types/video.types";
import { logVideoEvent, logVideoError } from "../utils/video.utils";

export class VideoManagementService {
  constructor() {
    // No dependencies needed
  }

  // ==================== AVATAR AND VOICE MANAGEMENT ====================

  async getUserAvatars(userId: string): Promise<{
    customAvatars: any[];
    defaultAvatars: any[];
  }> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const customAvatars = await DefaultAvatar.find({ userId: userObjectId });
      const defaultAvatars = await DefaultAvatar.find({
        userId: { $exists: false },
        default: true,
      });

      return {
        customAvatars,
        defaultAvatars,
      };
    } catch (error) {
      logVideoError(error as Error, { userId, action: "getUserAvatars" });
      throw new VideoError("Failed to retrieve avatars", 500);
    }
  }

  async getUserVoices(userId: string): Promise<{
    customVoices: any[];
    defaultVoices: any[];
  }> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const customVoices = await DefaultVoice.find({ userId: userObjectId });
      const defaultVoices = await DefaultVoice.find({
        userId: { $exists: false },
        default: true,
      });

      return {
        customVoices,
        defaultVoices,
      };
    } catch (error) {
      logVideoError(error as Error, { userId, action: "getUserVoices" });
      throw new VideoError("Failed to retrieve voices", 500);
    }
  }

  // ==================== PHOTO AVATAR CREATION ====================

  async createPhotoAvatar(avatarData: PhotoAvatarData): Promise<void> {
    try {
      await addPhotoAvatarJob({
        imagePath: avatarData.imagePath,
        age_group: avatarData.age_group,
        name: avatarData.name,
        gender: avatarData.gender,
        userId: avatarData.userId,
        ethnicity: avatarData.ethnicity,
        mimeType: avatarData.mimeType,
      });

      logVideoEvent("photo_avatar_creation_started", {
        userId: avatarData.userId,
        name: avatarData.name,
      });
    } catch (error) {
      logVideoError(error as Error, {
        avatarData,
        action: "createPhotoAvatar",
      });
      throw new VideoError("Failed to create photo avatar", 500);
    }
  }

  // ==================== WORKFLOW MANAGEMENT ====================

  async checkPendingWorkflows(userId: string): Promise<{
    hasPendingWorkflows: boolean;
    pendingCount: number;
    message?: string;
    workflows?: Array<{
      executionId: string;
      createdAt: string;
      email: string;
    }>;
  }> {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const pendingWorkflows = await WorkflowHistory.find({
        userId: userObjectId,
        status: "pending",
      });

      if (pendingWorkflows.length === 0) {
        return {
          hasPendingWorkflows: false,
          pendingCount: 0,
        };
      }

      // Send notifications for pending workflows
      for (const workflow of pendingWorkflows) {
        try {
          notificationService.notifyUser(userId, "video-download-update", {
            type: "progress",
            status: "processing",
            message: "Your video creation is in progress",
            timestamp: new Date().toISOString(),
          });
        } catch (notificationError) {
          logVideoError(notificationError as Error, {
            executionId: workflow.executionId,
            action: "sendNotification",
          });
        }
      }

      return {
        hasPendingWorkflows: true,
        pendingCount: pendingWorkflows.length,
        message: "Your video creation is in progress",
        workflows: pendingWorkflows.map((workflow) => ({
          executionId: workflow.executionId,
          createdAt: workflow.createdAt.toISOString(),
          email: workflow.email,
        })),
      };
    } catch (error) {
      logVideoError(error as Error, {
        userId,
        action: "checkPendingWorkflows",
      });
      throw new VideoError("Failed to check pending workflows", 500);
    }
  }

  async trackExecution(
    executionId: string,
    email: string
  ): Promise<{
    executionId: string;
    userId: string;
    email: string;
    timestamp: string;
  }> {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw new NotFoundError("User not found");
      }

      await WorkflowHistory.create({
        executionId,
        userId: user._id,
        email,
      });

      logVideoEvent("execution_tracked", {
        executionId,
        email,
        userId: user._id,
      });

      return {
        executionId,
        userId: user._id.toString(),
        email,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logVideoError(error as Error, {
        executionId,
        email,
        action: "trackExecution",
      });
      throw new VideoError("Failed to track execution", 500);
    }
  }

  // ==================== TOPIC MANAGEMENT ====================

  async getAllTopics(): Promise<any[]> {
    try {
      return await Topic.find().sort({ name: 1 });
    } catch (error) {
      logVideoError(error as Error, { action: "getAllTopics" });
      throw new VideoError("Failed to retrieve topics", 500);
    }
  }

  async getTopicByType(topic: string): Promise<any> {
    try {
      const topicData = await Topic.findOne({ type: topic });
      if (!topicData) {
        throw new NotFoundError("Topic not found");
      }
      return topicData;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logVideoError(error as Error, { topic, action: "getTopicByType" });
      throw new VideoError("Failed to retrieve topic", 500);
    }
  }

  async getTopicById(id: string): Promise<any> {
    try {
      const topicData = await Topic.findById(id);
      if (!topicData) {
        throw new NotFoundError("Topic not found");
      }
      return topicData;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logVideoError(error as Error, { id, action: "getTopicById" });
      throw new VideoError("Failed to retrieve topic", 500);
    }
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      database: "available" | "unavailable";
      queue: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      return {
        status: "healthy",
        services: {
          database: "available",
          queue: "available",
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          database: "unavailable",
          queue: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default VideoManagementService;
