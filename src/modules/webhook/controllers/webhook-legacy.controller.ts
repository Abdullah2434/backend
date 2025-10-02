import { Response } from "express";
import WebhookService from "../services/webhook.service";
import { WebhookResponse } from "../types/webhook.types";
import { logWebhookError, logWebhookEvent } from "../utils/webhook.utils";
import WorkflowHistory from "../../../database/models/WorkflowHistory";
import { notificationService } from "../../shared/notification";

const webhookService = new WebhookService();

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

// ==================== LEGACY WEBHOOK CONTROLLERS ====================

export const videoComplete = async (req: any, res: Response): Promise<void> => {
  try {
    logWebhookEvent("video_complete_webhook_received", {
      body: req.body,
      headers: req.headers,
    });

    const { videoId, status, s3Key, metadata, error } = req.body;

    const result = await webhookService.handleVideoComplete({
      videoId,
      status,
      s3Key,
      metadata,
      error,
    });

    if (result.success) {
      sendResponse(
        res,
        200,
        "Video complete webhook processed successfully",
        result
      );
    } else {
      sendResponse(
        res,
        400,
        "Video complete webhook processing failed",
        result
      );
    }
  } catch (error: any) {
    logWebhookError(error, { action: "videoComplete" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Video complete webhook processing failed"
    );
  }
};

export const handleWorkflowError = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    logWebhookEvent("workflow_error_webhook_received", {
      body: req.body,
      headers: req.headers,
    });

    const { errorMessage, executionId } = req.body;

    // Validate required fields
    if (!errorMessage || !executionId) {
      sendResponse(
        res,
        400,
        "Missing required fields: errorMessage, executionId"
      );
      return;
    }

    // Find user by execution ID
    const workflowHistory = await WorkflowHistory.findOne({
      executionId,
    }).populate("userId");

    if (!workflowHistory) {
      logWebhookEvent("workflow_not_found", { executionId });
      sendResponse(res, 404, "Execution not found");
      return;
    }

    // Convert technical error to user-friendly message
    const userFriendlyMessage =
      "Video creation failed. Please try again or contact support if the issue persists.";

    // Update workflow history to mark as failed
    await WorkflowHistory.findOneAndUpdate(
      { executionId },
      {
        status: "failed",
        completedAt: new Date(),
        errorMessage: errorMessage,
      }
    );

    logWebhookEvent("workflow_updated_failed", { executionId });

    // Send socket notification to user
    notificationService.notifyUser(
      workflowHistory.userId._id.toString(),
      "video-download-update",
      {
        type: "error",
        status: "error",
        message: userFriendlyMessage,
        timestamp: new Date().toISOString(),
      }
    );

    logWebhookEvent("workflow_error_notification_sent", {
      executionId,
      userId: workflowHistory.userId._id.toString(),
      email: workflowHistory.email,
    });

    sendResponse(res, 200, "Error notification sent successfully", {
      executionId,
      email: workflowHistory.email,
      originalError: errorMessage,
      userMessage: userFriendlyMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logWebhookError(error, { action: "handleWorkflowError" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Workflow error webhook processing failed"
    );
  }
};
