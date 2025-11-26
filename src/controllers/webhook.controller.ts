import { Request, Response } from "express";
import { WebhookService } from "../services/webhook";
import VideoScheduleService from "../services/videoSchedule";
import { WebhookRequest } from "../types";
import WorkflowHistory from "../models/WorkflowHistory";
import { notificationService } from "../services/notification.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  avatarWebhookSchema,
  testWebhookSchema,
  scheduledVideoCompleteSchema,
  verifyWebhookSchema,
  captionCompleteSchema,
  videoCompleteSchema,
  handleWorkflowErrorSchema,
} from "../validations/webhook.validations";

// ==================== CONSTANTS ====================
const DEFAULT_WEBHOOK_URL = "https://webhook.site/test";
const WEBHOOK_VERSION = "1.0.0";
const USER_FRIENDLY_ERROR_MESSAGE =
  "Video creation failed. Please try again or contact support if the issue persists.";

const WEBHOOK_FEATURES = [
  "User authentication",
  "Signature verification",
  "Custom payloads",
  "Error handling",
] as const;

// ==================== SERVICE INSTANCE ====================
const webhookService = new WebhookService();

// ==================== HELPER FUNCTIONS ====================
/**
 * Extract authorization token from request headers
 */
function extractAuthToken(req: Request): string | undefined {
  return req.headers.authorization;
}

/**
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Custom webhook endpoint for video avatar notifications
 * POST /v2/webhook/avatar
 */
export async function avatarWebhook(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = avatarWebhookSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const {
      avatar_id,
      status,
      avatar_group_id,
      callback_id,
      user_id,
      webhook_url,
    } = validationResult.data;

    const webhookPayload: WebhookRequest = {
      avatar_id,
      status,
      avatar_group_id,
      callback_id,
      user_id,
    };

    // Get user token from headers
    const userToken = extractAuthToken(req);

    // Process webhook with user authentication
    const result = await webhookService.processWebhookWithAuth(
      webhook_url || DEFAULT_WEBHOOK_URL,
      webhookPayload,
      userToken
    );

    return ResponseHelper.success(res, "Webhook processed successfully", result);
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
    const validationResult = testWebhookSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const {
      videoId,
      status,
      s3Key,
      metadata,
      error,
      scheduleId,
      trendIndex,
      captions,
    } = validationResult.data;

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

    return ResponseHelper.success(res, "Test webhook processed successfully", result);
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
    const validationResult = scheduledVideoCompleteSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const {
      videoId,
      status,
      s3Key,
      metadata,
      error,
      scheduleId,
      trendIndex,
      captions,
    } = validationResult.data;

    // Process the scheduled video complete webhook
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
    const validationResult = verifyWebhookSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { payload, signature } = validationResult.data;

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
    return ResponseHelper.success(
      res,
      "Webhook service is operational",
      {
        timestamp: new Date().toISOString(),
        version: WEBHOOK_VERSION,
        features: WEBHOOK_FEATURES,
      }
    );
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
    const validationResult = captionCompleteSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { videoId, status, email, title } = validationResult.data;

    const result = await webhookService.handleCaptionComplete({
      videoId,
      status,
      email,
      title,
    });

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
    const validationResult = videoCompleteSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const {
      videoId,
      status,
      s3Key,
      metadata,
      error,
      scheduleId,
      trendIndex,
      captions,
    } = validationResult.data;

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
    const validationResult = handleWorkflowErrorSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { errorMessage, executionId, scheduleId, trendIndex } =
      validationResult.data;

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
        message: USER_FRIENDLY_ERROR_MESSAGE,
        timestamp: new Date().toISOString(),
      }
    );

    return ResponseHelper.success(
      res,
      "Error notification sent successfully",
      {
        executionId,
        email: workflowHistory.email,
        originalError: errorMessage,
        userMessage: USER_FRIENDLY_ERROR_MESSAGE,
        timestamp: new Date().toISOString(),
      }
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
