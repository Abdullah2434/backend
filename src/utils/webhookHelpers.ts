import { Request } from "express";
import { WebhookRequest, WebhookResponse, WebhookResult } from "../types";
import {
  DEFAULT_WEBHOOK_URL,
  USER_FRIENDLY_ERROR_MESSAGE,
  VALID_AVATAR_STATUSES,
} from "../constants/webhook.constants";
import crypto from "crypto";

// ==================== CONTROLLER HELPER FUNCTIONS ====================

/**
 * Extract authorization token from request headers
 */
export function extractAuthToken(req: Request): string | undefined {
  return req.headers.authorization;
}

/**
 * Build webhook payload from validated data (controller-level)
 */
export function buildWebhookPayload(data: {
  avatar_id: string;
  status: string;
  avatar_group_id: string;
  callback_id?: string;
  user_id?: string;
}): WebhookRequest {
  return {
    avatar_id: data.avatar_id,
    status: data.status as "completed" | "failed",
    avatar_group_id: data.avatar_group_id,
    callback_id: data.callback_id,
    user_id: data.user_id,
  };
}

/**
 * Get webhook URL with fallback to default
 */
export function getWebhookUrl(webhookUrl?: string): string {
  return webhookUrl || DEFAULT_WEBHOOK_URL;
}

/**
 * Build video complete payload
 */
export function buildVideoCompletePayload(data: {
  videoId: string;
  status?: string;
  s3Key?: string;
  metadata?: any;
  error?: string;
  scheduleId?: string;
  trendIndex?: number;
  captions?: any;
}) {
  return {
    videoId: data.videoId,
    status: data.status,
    s3Key: data.s3Key,
    metadata: data.metadata,
    error: data.error,
    scheduleId: data.scheduleId,
    trendIndex: data.trendIndex,
    captions: data.captions,
  };
}

/**
 * Build caption complete payload
 */
export function buildCaptionCompletePayload(data: {
  videoId: string;
  status: string;
  email?: string;
  title?: string;
}) {
  return {
    videoId: data.videoId,
    status: data.status,
    email: data.email,
    title: data.title,
  };
}

/**
 * Check if schedule context is valid
 */
export function isValidScheduleContext(
  scheduleId?: string,
  trendIndex?: number
): boolean {
  return !!(
    scheduleId &&
    (trendIndex === 0 || Number.isInteger(trendIndex))
  );
}

/**
 * Build error notification payload
 */
export function buildErrorNotificationPayload() {
  return {
    type: "error",
    status: "error",
    message: USER_FRIENDLY_ERROR_MESSAGE,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build workflow error response payload
 */
export function buildWorkflowErrorResponsePayload(
  executionId: string,
  email: string,
  errorMessage: string
) {
  return {
    executionId,
    email,
    originalError: errorMessage,
    userMessage: USER_FRIENDLY_ERROR_MESSAGE,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Determine HTTP status code based on error message
 */
export function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

// ==================== SERVICE-LEVEL UTILITY FUNCTIONS ====================

/**
 * Build webhook payload with user information (service-level)
 */
export function buildWebhookPayloadWithUser(
  payload: WebhookRequest,
  user?: any
): WebhookRequest {
  const webhookPayload: WebhookRequest = { ...payload };
  if (user) {
    webhookPayload.user_id = user.id;
  }
  return webhookPayload;
}

/**
 * Build webhook headers
 */
export function buildWebhookHeaders(payload: WebhookRequest): Record<string, string> {
  const secret = process.env.WEBHOOK_SECRET || "default-secret";
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadString)
    .digest("hex");

  return {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature,
    "X-Webhook-Timestamp": new Date().toISOString(),
  };
}

/**
 * Build success webhook response
 */
export function buildSuccessWebhookResponse(data: any): WebhookResponse {
  return {
    success: true,
    message: "Webhook processed successfully",
    data,
  };
}

/**
 * Build error webhook response
 */
export function buildErrorWebhookResponse(error: any): WebhookResponse {
  return {
    success: false,
    message: error.message || "Webhook processing failed",
    data: {
      error: error.message || "Unknown error",
    },
  };
}

/**
 * Build webhook result
 */
export function buildWebhookResult(
  success: boolean,
  message: string,
  data: any
): WebhookResult {
  return {
    success,
    message,
    data,
  };
}

/**
 * Validate video ID
 */
export function validateVideoId(videoId: string): void {
  if (!videoId || typeof videoId !== "string" || videoId.trim() === "") {
    throw new Error("Video ID is required and must be a non-empty string");
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(payload: any, signature: string): boolean {
  try {
    const secret = process.env.WEBHOOK_SECRET || "default-secret";
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadString)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}
