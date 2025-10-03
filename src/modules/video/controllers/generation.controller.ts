import { Request, Response } from "express";
import multer from "multer";
import { videoGenerationService } from "../services/generation.service";
import { videoService } from "../services/video.service";
import { videoCreationService } from "../services/video-creation.service";
import { queueManager } from "../../jobs";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";
import User from "../../../models/User";
import WorkflowHistory from "../../../models/WorkflowHistory";
import { notificationService } from "../../../services/notification.service";

const upload = multer({ dest: "/tmp" });

/**
 * Create video via webhook
 */
export const createVideo = asyncHandler(async (req: Request, res: Response) => {
  const requiredFields = [
    "prompt",
    "avatar",
    "name",
    "position",
    "companyName",
    "license",
    "tailoredFit",
    "socialHandles",
    "videoTopic",
    "topicKeyPoints",
    "city",
    "preferredTone",
    "callToAction",
    "email",
  ];

  for (const field of requiredFields) {
    if (!req.body[field] || String(req.body[field]).trim() === "") {
      return ResponseHelper.badRequest(res, `${field} is required`);
    }
  }

  // Generate unique request ID
  const requestId = `video_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    // Save video creation record to database FIRST
    const videoCreationRecord = await videoCreationService.createVideoCreationRecord(
      req.body,
      requestId
    );

    // Update status to processing
    await videoCreationService.updateVideoCreationStatus(
      requestId,
      "processing"
    );

    // Send to n8n webhook
    const result = await videoGenerationService.createVideo({
      ...req.body,
      requestId, // Include requestId in webhook data
    });

    // Update with webhook response
    await videoCreationService.updateVideoCreationStatus(
      requestId,
      "processing",
      result.webhookResult
    );

    return ResponseHelper.success(
      res,
      "Video creation request submitted successfully",
      {
        requestId: videoCreationRecord.requestId,
        webhookResponse: result.webhookResult,
        timestamp: result.timestamp,
        status: "processing",
        databaseRecord: {
          id: videoCreationRecord._id,
          createdAt: videoCreationRecord.createdAt,
        },
      }
    );
  } catch (error: any) {
    // Update status to failed if there's an error
    await videoCreationService.updateVideoCreationStatus(
      requestId,
      "failed",
      null,
      error.message
    );

    throw error; // Re-throw to be handled by error middleware
  }
});

/**
 * Generate video via n8n webhook
 */
export const generateVideo = asyncHandler(
  async (req: Request, res: Response) => {
    const requiredFields = [
      "hook",
      "body",
      "conclusion",
      "company_name",
      "social_handles",
      "license",
      "avatar_title",
      "avatar_body",
      "avatar_conclusion",
      "email",
      "title",
    ];

    for (const field of requiredFields) {
      if (!req.body[field] || String(req.body[field]).trim() === "") {
        return ResponseHelper.badRequest(
          res,
          `Missing or empty required field: ${field}`
        );
      }
    }

    // Fire and forget - webhook sent in background
    await videoGenerationService.generateVideo(req.body);

    return ResponseHelper.success(
      res,
      "Video generation started successfully",
      {
        status: "processing",
        timestamp: new Date().toISOString(),
        estimated_completion: new Date(
          Date.now() + 15 * 60 * 1000
        ).toISOString(),
        note: "Video generation is running in the background. The video will be available when ready.",
      }
    );
  }
);

/**
 * Download and upload video
 */
export const downloadVideo = asyncHandler(
  async (req: Request, res: Response) => {
    const { videoUrl, email, title, executionId } = req.body;

    // Validate required fields
    const requiredFields = ["videoUrl", "email", "title"];
    for (const field of requiredFields) {
      if (!req.body[field] || String(req.body[field]).trim() === "") {
        return ResponseHelper.badRequest(
          res,
          `Missing required field: ${field}`
        );
      }
    }

    const user = await videoService.getUserByEmail(email);
    if (!user) {
      return ResponseHelper.notFound(res, "User not found");
    }

    // Send initial notification
    notificationService.notifyVideoDownloadProgress(
      user._id.toString(),
      "download",
      "progress",
      {
        message: "Starting video download...",
      }
    );

    const result = await videoService.downloadAndUploadVideo({
      videoUrl,
      email,
      title,
      executionId,
    });

    // Update workflow history if executionId is provided
    if (executionId) {
      try {
        await WorkflowHistory.findOneAndUpdate(
          { executionId },
          {
            status: "completed",
            completedAt: new Date(),
          }
        );
      } catch (workflowError) {
        console.error(
          `Error updating workflow history for execution ${executionId}:`,
          workflowError
        );
      }
    }

    // Send success notification
    notificationService.notifyVideoDownloadProgress(
      user._id.toString(),
      "complete",
      "success",
      {
        message: "Video downloaded and uploaded successfully!",
        videoId: result.videoId,
        title: result.title,
        size: result.size,
      }
    );

    return ResponseHelper.success(
      res,
      "Video downloaded and uploaded successfully",
      result
    );
  }
);

/**
 * Track execution
 */
export const trackExecution = asyncHandler(
  async (req: Request, res: Response) => {
    const { executionId, email } = req.body;

    if (!executionId || !email) {
      return ResponseHelper.badRequest(
        res,
        "Missing required fields: executionId, email"
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      return ResponseHelper.notFound(res, "User not found");
    }

    // Create workflow history entry
    await WorkflowHistory.create({
      executionId,
      userId: user._id,
      email,
    });

    return ResponseHelper.success(res, "Execution tracked successfully", {
      executionId,
      userId: user._id,
      email,
      timestamp: new Date().toISOString(),
    });
  }
);

/**
 * Check pending workflows
 */
export const checkPendingWorkflows = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId) {
      return ResponseHelper.badRequest(
        res,
        "Missing required parameter: userId"
      );
    }

    const result = await videoService.checkPendingWorkflows(userId);

    if (!result.hasPendingWorkflows) {
      return ResponseHelper.success(res, "No pending workflows found", {
        hasPendingWorkflows: false,
        pendingCount: 0,
        message: null,
      });
    }

    // Notify user about pending workflows
    for (const workflow of result.workflows) {
      try {
        notificationService.notifyUser(userId, "video-download-update", {
          type: "progress",
          status: "processing",
          message: "Your video creation is in progress",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    }

    return ResponseHelper.success(res, "Pending workflows found", {
      hasPendingWorkflows: true,
      pendingCount: result.pendingCount,
      message: "Your video creation is in progress",
      workflows: result.workflows,
    });
  }
);

/**
 * Create photo avatar
 */
export const createPhotoAvatarUpload = upload.single("image");

export const createPhotoAvatar = asyncHandler(
  async (req: Request & { file?: Express.Multer.File }, res: Response) => {
    const { age_group, name, gender, userId, ethnicity } = req.body;

    if (!req.file || !age_group || !name || !gender || !userId) {
      return ResponseHelper.badRequest(res, "Missing required fields");
    }

    // Add job to BullMQ queue
    await queueManager.addJob("photo-avatar", {
      imagePath: req.file.path,
      age_group,
      name,
      gender,
      userId,
      ethnicity,
      mimeType: req.file.mimetype,
    });

    return ResponseHelper.success(
      res,
      "Photo avatar creation started. You will be notified when ready."
    );
  }
);
