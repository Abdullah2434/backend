import { Request, Response } from "express";
import WebhookService from "../services/webhook.service";
import VideoScheduleService from "../services/videoSchedule.service";
import { WebhookResult, ApiResponse } from "../types";
import WorkflowHistory from "../models/WorkflowHistory";
import { notificationService } from "../services/notification.service";

const webhookService = new WebhookService();

export async function videoComplete(req: Request, res: Response) {
  try {
    console.log("Video complete webhook received:", req.body);

    const {
      videoId,
      status,
      s3Key,
      metadata,
      error,
      scheduleId,
      trendIndex,
      captions,
    } = req.body;

    console.log("📋 Webhook parameters:");
    console.log(`  📋 Video ID: ${videoId}`);
    console.log(`  📋 Status: ${status}`);
    console.log(`  📋 Schedule ID: ${scheduleId}`);
    console.log(`  📋 Trend Index: ${trendIndex}`);
    console.log(`  📋 Error: ${error}`);

    const result = await webhookService.handleVideoComplete({
      videoId,
      status,
      s3Key,
      metadata,
      error,
      scheduleId,
      trendIndex,
      captions,
    });

    return res.json(result);
  } catch (e: any) {
    console.error("Video complete webhook error:", e);

    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

export async function scheduledVideoComplete(req: Request, res: Response) {
  try {
    console.log("Scheduled video complete webhook received:", req.body);

    const {
      videoId,
      status,
      s3Key,
      metadata,
      error,
      scheduleId,
      trendIndex,
      captions,
    } = req.body;

    // Validate required fields for scheduled videos
    if (!scheduleId || trendIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: scheduleId, trendIndex",
      });
    }

    console.log("📋 Scheduled Video Webhook parameters:");
    console.log(`  📋 Video ID: ${videoId}`);
    console.log(`  📋 Status: ${status}`);
    console.log(`  📋 Schedule ID: ${scheduleId}`);
    console.log(`  📋 Trend Index: ${trendIndex}`);
    console.log(`  📋 Error: ${error}`);

    const result = await webhookService.handleVideoComplete({
      videoId,
      status,
      s3Key,
      metadata,
      error,
      scheduleId,
      trendIndex,
      captions,
    });

    return res.json(result);
  } catch (e: any) {
    console.error("Scheduled video complete webhook error:", e);

    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

export async function handleWorkflowError(req: Request, res: Response) {
  try {
    console.log("Workflow error webhook received:", req.body);

    const { errorMessage, executionId, scheduleId, trendIndex } = req.body;

    // Validate required fields
    if (!errorMessage || !executionId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: errorMessage, executionId",
      });
    }
    console.log("Workflow error webhook received:", req.body);
    // Find user by execution ID
    const workflowHistory = await WorkflowHistory.findOne({
      executionId,
    }).populate("userId");

    if (!workflowHistory) {
      console.log(`No workflow history found for execution ID: ${executionId}`);
      return res.status(404).json({
        success: false,
        message: "Execution not found",
      });
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
    console.log(
      `Workflow history updated for execution ${executionId}: failed`
    );

    // If schedule context is provided, mark schedule item as failed
    if (scheduleId && (trendIndex === 0 || Number.isInteger(trendIndex))) {
      try {
        const videoScheduleService = new VideoScheduleService();
        await videoScheduleService.updateVideoStatus(
          String(scheduleId),
          Number(trendIndex),
          "failed"
        );
        console.log(
          `📉 Marked schedule ${scheduleId} trend ${trendIndex} as failed due to workflow error`
        );
      } catch (updateErr) {
        console.warn(
          "Failed to update schedule status to failed from workflow-error webhook:",
          updateErr
        );
      }
    }

    // Send socket notification to user
    console.log(
      "Sending workflow error notification to user:",
      workflowHistory.userId._id.toString()
    );
    console.log("User :", workflowHistory);
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

    console.log(
      `Workflow error notification sent to user: ${workflowHistory.email}`
    );

    return res.json({
      success: true,
      message: "Error notification sent successfully",
      data: {
        executionId,
        email: workflowHistory.email,
        originalError: errorMessage,
        userMessage: userFriendlyMessage,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    console.error("Workflow error webhook error:", e);

    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}
