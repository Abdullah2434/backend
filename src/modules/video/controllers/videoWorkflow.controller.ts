import { Request, Response } from "express";
import User from "../../../models/User";
import WorkflowHistory from "../../../models/WorkflowHistory";
import { notificationService } from "../../../services/notification.service";
import {
  validateTrackExecution,
  validateUserIdParam,
} from "../../../validations/video.validations";
import {
  isValidObjectId,
  toObjectId,
  getErrorStatus,
} from "../../../utils/videoHelpers";

/**
 * Track workflow execution
 * POST /api/video/track-execution
 */
export async function trackExecution(req: Request, res: Response) {
  try {
    const validationResult = validateTrackExecution(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
      });
    }

    const { executionId, email } = validationResult.data!;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Create workflow history entry
    const workflowHistory = new WorkflowHistory({
      executionId,
      userId: user._id,
      email,
    });

    await workflowHistory.save();

    return res.json({
      success: true,
      message: "Execution tracked successfully",
      data: {
        executionId,
        userId: user._id,
        email,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Check pending workflows for a user
 * GET /api/video/pending-workflows/:userId
 */
export async function checkPendingWorkflows(req: Request, res: Response) {
  try {
    const validationResult = validateUserIdParam(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
      });
    }

    const { userId } = validationResult.data!;

    // Validate userId format (should be a valid ObjectId string)
    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId format",
      });
    }

    // Convert string userId to ObjectId for database query
    const userObjectId = toObjectId(userId);

    // Find all pending workflows for this user
    const pendingWorkflows = await WorkflowHistory.find({
      userId: userObjectId,
      status: "pending",
    });

    if (pendingWorkflows.length === 0) {
      return res.json({
        success: true,
        message: "No pending workflows found",
        data: {
          hasPendingWorkflows: false,
          pendingCount: 0,
          message: null,
        },
      });
    }

    // Send socket notification for each pending workflow
    for (const workflow of pendingWorkflows) {
      try {
        notificationService.notifyUser(userId, "video-download-update", {
          type: "progress",
          status: "processing",
          message: "Your video creation is in progress",
          timestamp: new Date().toISOString(),
        });
      } catch (notificationError) {}
    }

    // Return pending workflow information
    return res.json({
      success: true,
      message: "Pending workflows found",
      data: {
        hasPendingWorkflows: true,
        pendingCount: pendingWorkflows.length,
        message: "Your video creation is in progress",
        workflows: pendingWorkflows.map((workflow) => ({
          executionId: workflow.executionId,
          createdAt: workflow.createdAt,
          email: workflow.email,
        })),
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}
