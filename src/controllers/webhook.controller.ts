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
import {
  extractAccessToken,
  formatValidationErrors,
  handleControllerError,
} from "../utils/controllerHelpers";
import {
  DEFAULT_WEBHOOK_URL,
  WEBHOOK_VERSION,
  USER_FRIENDLY_ERROR_MESSAGE,
  WEBHOOK_FEATURES,
} from "../constants/webhook.constants";

// ==================== SERVICE INSTANCE ====================
const webhookService = new WebhookService();

// ==================== HELPER FUNCTIONS ====================

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Custom webhook endpoint for video avatar notifications
 * POST /v2/webhook/avatar
 */
export async function avatarWebhook(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Validate request body
    const validationResult = avatarWebhookSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
    const userToken = extractAccessToken(req) || undefined;

    // Process webhook with user authentication
    const result = await webhookService.processWebhookWithAuth(
      webhook_url || DEFAULT_WEBHOOK_URL,
      webhookPayload,
      userToken
    );

    return ResponseHelper.success(
      res,
      "Webhook processed successfully",
      result
    );
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "avatarWebhook",
      "Internal server error"
    );
  }
}

/**
 * Test webhook endpoint
 * POST /v2/webhook/test
 */
export async function testWebhook(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Validate request body
    const validationResult = testWebhookSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
      "Test webhook processed successfully",
      result
    );
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "testWebhook",
      "Internal server error"
    );
  }
}

/**
 * Scheduled video complete webhook
 * POST /v2/webhook/scheduled-video-complete
 */
export async function scheduledVideoComplete(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Validate request body
    const validationResult = scheduledVideoCompleteSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "scheduledVideoComplete",
      "Internal server error"
    );
  }
}

/**
 * Verify webhook signature
 * POST /v2/webhook/verify
 */
export async function verifyWebhook(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Validate request body
    const validationResult = verifyWebhookSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { payload, signature } = validationResult.data;

    const isValid = webhookService.verifyWebhookSignature(payload, signature);

    return ResponseHelper.success(
      res,
      isValid ? "Signature is valid" : "Signature is invalid",
      { isValid }
    );
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "verifyWebhook",
      "Internal server error"
    );
  }
}

/**
 * Get webhook status
 * GET /v2/webhook/status
 */
export async function getWebhookStatus(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    return ResponseHelper.success(res, "Webhook service is operational", {
      timestamp: new Date().toISOString(),
      version: WEBHOOK_VERSION,
      features: WEBHOOK_FEATURES,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "getWebhookStatus",
      "Internal server error"
    );
  }
}

/**
 * Caption complete webhook
 * POST /webhook/caption-complete
 */
export async function captionComplete(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Validate request body
    const validationResult = captionCompleteSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "captionComplete",
      "Internal server error"
    );
  }
}

/**
 * Video complete webhook (legacy function for v1 compatibility)
 * POST /webhook/video-complete
 */
export async function videoComplete(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Validate request body
    const validationResult = videoCompleteSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "videoComplete",
      "Internal server error"
    );
  }
}

/**
 * Handle workflow error (legacy function for v1 compatibility)
 * POST /webhook/workflow-error
 */
export async function handleWorkflowError(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Validate request body
    const validationResult = handleWorkflowErrorSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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

    return ResponseHelper.success(res, "Error notification sent successfully", {
      executionId,
      email: workflowHistory.email,
      originalError: errorMessage,
      userMessage: USER_FRIENDLY_ERROR_MESSAGE,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "handleWorkflowError",
      "Internal server error"
    );
  }
}
