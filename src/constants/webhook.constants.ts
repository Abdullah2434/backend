/**
 * Constants for webhook controller
 */

// ==================== WEBHOOK CONFIGURATION ====================
export const DEFAULT_WEBHOOK_URL = "https://webhook.site/test";
export const WEBHOOK_VERSION = "1.0.0";
export const USER_FRIENDLY_ERROR_MESSAGE =
  "Video creation failed. Please try again or contact support if the issue persists.";

// ==================== WEBHOOK FEATURES ====================
export const WEBHOOK_FEATURES = [
  "User authentication",
  "Signature verification",
  "Custom payloads",
  "Error handling",
] as const;

