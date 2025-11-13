import { Request, Response } from "express";
import WebhookService from "../services/webhook.service";
import VideoScheduleService from "../services/videoSchedule.service";
import { WebhookResult, ApiResponse, WebhookRequest } from "../types";
import WorkflowHistory from "../models/WorkflowHistory";
import { notificationService } from "../services/notification.service";

const webhookService = new WebhookService();

/**
 * Custom webhook endpoint for video avatar notifications
 * POST /v2/webhook/avatar
 */
export async function avatarWebhook(req: Request, res: Response) {
  try {
    const { avatar_id, status, avatar_group_id, callback_id, user_id } =
      req.body;

    // Validate required fields
    if (!avatar_id || !status || !avatar_group_id) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: avatar_id, status, and avatar_group_id are required",
      });
    }

    // Validate status
    if (!["completed", "failed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "completed" or "failed"',
      });
    }

    const webhookPayload: WebhookRequest = {
      avatar_id,
      status,
      avatar_group_id,
      callback_id,
      user_id,
    };

    // Get user token from headers
    const userToken = req.headers.authorization;

    // Process webhook with user authentication
    const result = await webhookService.processWebhookWithAuth(
      req.body.webhook_url || "https://webhook.site/test",
      webhookPayload,
      userToken
    );

    return res.status(200).json(result);
  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * Test webhook endpoint
 * POST /v2/webhook/test
 */
export async function testWebhook(req: Request, res: Response) {
  try {

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
   
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

export async function scheduledVideoComplete(req: Request, res: Response) {
  try {
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

  } catch (error: any) {
   
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * Verify webhook signature
 * POST /v2/webhook/verify
 */
export async function verifyWebhook(req: Request, res: Response) {
  try {
    const { payload, signature } = req.body;

    if (!payload || !signature) {
      return res.status(400).json({
        success: false,
        message: "payload and signature are required",
      });
    }

    const isValid = webhookService.verifyWebhookSignature(payload, signature);

    return res.status(200).json({
      success: true,
      message: isValid ? "Signature is valid" : "Signature is invalid",
      data: { isValid },
    });
  } catch (error: any) {
  
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * Get webhook status
 * GET /v2/webhook/status
 */
export async function getWebhookStatus(req: Request, res: Response) {
  try {
    return res.status(200).json({
      success: true,
      message: "Webhook service is operational",
      data: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        features: [
          "User authentication",
          "Signature verification",
          "Custom payloads",
          "Error handling",
        ],
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * Caption complete webhook
 * POST /webhook/caption-complete
 */
export async function captionComplete(req: Request, res: Response) {
  try {

    const { videoId, status, email, title } = req.body;

    const result = await webhookService.handleCaptionComplete({
      videoId,
      status,
      email,
      title,
    });

    return res.json(result);
  } catch (e: any) {
 

    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Video complete webhook (legacy function for v1 compatibility)
 * POST /webhook/video-complete
 */
export async function videoComplete(req: Request, res: Response) {
  try {
 
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

    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Handle workflow error (legacy function for v1 compatibility)
 * POST /webhook/workflow-error
 */
export async function handleWorkflowError(req: Request, res: Response) {
  try {


    const { errorMessage, executionId, scheduleId, trendIndex } = req.body;
    // Validate required fields
    if (!errorMessage || !executionId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: errorMessage, executionId",
      });
    }

    // Find user by execution ID
    const workflowHistory = await WorkflowHistory.findOne({
      executionId,
    }).populate("userId");

    if (!workflowHistory) {
    
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
    // If schedule context is provided, mark schedule item as failed
    if (scheduleId && (trendIndex === 0 || Number.isInteger(trendIndex))) {
      try {
        const videoScheduleService = new VideoScheduleService();
        await videoScheduleService.updateVideoStatus(
          String(scheduleId),
          Number(trendIndex),
          "failed"
        );
      
      } catch (updateErr) {
        console.warn(
          "Failed to update schedule status to failed from workflow-error webhook:",
          updateErr
        );
      }
    }

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

    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}
