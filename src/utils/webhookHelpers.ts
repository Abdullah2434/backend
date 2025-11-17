import * as crypto from "crypto";
import { WebhookRequest, VideoAvatarCallbackPayload } from "../types";

// ==================== CONSTANTS ====================
export const WEBHOOK_USER_AGENT = "VideoAvatar-Webhook/1.0";
export const WEBHOOK_CONTENT_TYPE = "application/json";
export const WEBHOOK_SIGNATURE_HEADER = "X-Webhook-Signature";
export const DEFAULT_WEBHOOK_SECRET = "default-webhook-secret";
export const HMAC_ALGORITHM = "sha256";

// ==================== SIGNATURE UTILITIES ====================
/**
 * Generate webhook signature for security
 */
export function generateWebhookSignature(payload: any): string {
  const secret = process.env.WEBHOOK_SECRET || DEFAULT_WEBHOOK_SECRET;
  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac(HMAC_ALGORITHM, secret)
    .update(payloadString)
    .digest("hex");
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: any,
  signature: string
): boolean {
  try {
    const expectedSignature = generateWebhookSignature(payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    return false;
  }
}

// ==================== PAYLOAD BUILDING ====================
/**
 * Build webhook payload with user information
 */
export function buildWebhookPayload(
  payload: WebhookRequest,
  user?: any
): VideoAvatarCallbackPayload {
  const webhookPayload: VideoAvatarCallbackPayload = {
    avatar_id: payload.avatar_id,
    status: payload.status,
    avatar_group_id: payload.avatar_group_id,
    callback_id: payload.callback_id,
    user_id: payload.user_id,
  };

  // Add user information if available
  if (user) {
    webhookPayload.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  return webhookPayload;
}

// ==================== HEADER BUILDING ====================
/**
 * Build webhook request headers
 */
export function buildWebhookHeaders(payload: any): Record<string, string> {
  return {
    "Content-Type": WEBHOOK_CONTENT_TYPE,
    "User-Agent": WEBHOOK_USER_AGENT,
    [WEBHOOK_SIGNATURE_HEADER]: generateWebhookSignature(payload),
  };
}

// ==================== RESPONSE BUILDING ====================
/**
 * Build success webhook response
 */
export function buildSuccessWebhookResponse(data?: any) {
  return {
    success: true,
    message: "Webhook sent successfully",
    data: data || null,
  };
}

/**
 * Build error webhook response
 */
export function buildErrorWebhookResponse(error: any) {
  return {
    success: false,
    message: `Webhook failed: ${error?.message || "Unknown error"}`,
    data: null,
  };
}

/**
 * Build webhook result response
 */
export function buildWebhookResult(
  success: boolean,
  message: string,
  data?: any
) {
  return {
    success,
    message,
    data: data || null,
  };
}

// ==================== VALIDATION ====================
/**
 * Validate webhook URL
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate video ID is present
 */
export function validateVideoId(videoId: string | undefined): void {
  if (!videoId) {
    throw new Error("Video ID is required");
  }
}

