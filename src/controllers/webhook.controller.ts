import { Request, Response } from "express";
import WebhookService from "../services/webhook.service";
import VideoScheduleService from "../services/videoSchedule.service";
import WorkflowHistory from "../models/WorkflowHistory";
import { notificationService } from "../services/notification.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateAvatarWebhook,
  validateTestWebhook,
  validateScheduledVideoComplete,
  validateVerifyWebhook,
  validateCaptionComplete,
  validateVideoComplete,
  validateHandleWorkflowError,
} from "../validations/webhook.validations";
import {
  extractAuthToken,
  buildWebhookPayload,
  getWebhookUrl,
  buildVideoCompletePayload,
  buildCaptionCompletePayload,
  isValidScheduleContext,
  buildErrorNotificationPayload,
  buildWorkflowErrorResponsePayload,
  getErrorStatus,
} from "../utils/webhookHelpers";
import {
  WEBHOOK_VERSION,
  WEBHOOK_FEATURES,
} from "../constants/webhook.constants";

// ==================== SERVICE INSTANCE ====================
const webhookService = new WebhookService();

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Custom webhook endpoint for video avatar notifications
 * POST /v2/webhook/avatar
 */
export async function avatarWebhook(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = validateAvatarWebhook(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const {
      avatar_id,
      status,
      avatar_group_id,
      callback_id,
      user_id,
      webhook_url,
    } = validationResult.data!;

    const webhookPayload = buildWebhookPayload({
      avatar_id,
      status,
      avatar_group_id,
      callback_id,
      user_id,
    });

    // Get user token from headers
    const userToken = extractAuthToken(req);

    // Process webhook with user authentication
    const result = await webhookService.processWebhookWithAuth(
      getWebhookUrl(webhook_url),
      webhookPayload,
      userToken
    );

    return ResponseHelper.success(
      res,
      "Webhook processed successfully",
      result
    );
  } catch (error: any) {
    console.error("Error in avatarWebhook:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
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
    // Validate request body
    const validationResult = validateTestWebhook(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const result = await webhookService.handleVideoComplete(
      buildVideoCompletePayload(validationResult.data!)
    );

    return ResponseHelper.success(
      res,
      "Test webhook processed successfully",
      result
    );
  } catch (error: any) {
    console.error("Error in testWebhook:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * Scheduled video complete webhook
 * POST /v2/webhook/scheduled-video-complete
 */
export async function scheduledVideoComplete(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = validateScheduledVideoComplete(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    // Process the scheduled video complete webhook
    const result = await webhookService.handleVideoComplete(
      buildVideoCompletePayload(validationResult.data!)
    );

    return ResponseHelper.success(
      res,
      "Scheduled video complete webhook processed successfully",
      result
    );
  } catch (error: any) {
    console.error("Error in scheduledVideoComplete:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
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
    // Validate request body
    const validationResult = validateVerifyWebhook(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { payload, signature } = validationResult.data!;

    const isValid = webhookService.verifyWebhookSignature(payload, signature);

    return ResponseHelper.success(
      res,
      isValid ? "Signature is valid" : "Signature is invalid",
      { isValid }
    );
  } catch (error: any) {
    console.error("Error in verifyWebhook:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
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
    return ResponseHelper.success(res, "Webhook service is operational", {
      timestamp: new Date().toISOString(),
      version: WEBHOOK_VERSION,
      features: WEBHOOK_FEATURES,
    });
  } catch (error: any) {
    console.error("Error in getWebhookStatus:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
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
    // Validate request body
    const validationResult = validateCaptionComplete(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const result = await webhookService.handleCaptionComplete(
      buildCaptionCompletePayload(validationResult.data!)
    );

    return ResponseHelper.success(
      res,
      "Caption complete webhook processed successfully",
      result
    );
  } catch (error: any) {
    console.error("Error in captionComplete:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * Video complete webhook (legacy function for v1 compatibility)
 * POST /webhook/video-complete
 */
export async function videoComplete(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = validateVideoComplete(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const result = await webhookService.handleVideoComplete(
      buildVideoCompletePayload(validationResult.data!)
    );

    return ResponseHelper.success(
      res,
      "Video complete webhook processed successfully",
      result
    );
  } catch (error: any) {
    console.error("Error in videoComplete:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * Handle workflow error (legacy function for v1 compatibility)
 * POST /webhook/workflow-error
 */
export async function handleWorkflowError(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = validateHandleWorkflowError(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { errorMessage, executionId, scheduleId, trendIndex } =
      validationResult.data!;

    // Find user by execution ID
    const workflowHistory = await WorkflowHistory.findOne({
      executionId,
    }).populate("userId");

    if (!workflowHistory) {
      return ResponseHelper.notFound(res, "Execution not found");
    }

    // Update workflow history to mark as failed
    await WorkflowHistory.findOneAndUpdate(
      { executionId },
      {
        status: "failed",
        completedAt: new Date(),
        errorMessage,
      }
    );

    // If schedule context is provided, mark schedule item as failed
    if (isValidScheduleContext(scheduleId, trendIndex)) {
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
      buildErrorNotificationPayload()
    );

    return ResponseHelper.success(
      res,
      "Error notification sent successfully",
      buildWorkflowErrorResponsePayload(
        executionId,
        workflowHistory.email,
        errorMessage
      )
    );
  } catch (error: any) {
    console.error("Error in handleWorkflowError:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}
