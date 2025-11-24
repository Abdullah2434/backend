// ==================== WEBHOOK CONSTANTS ====================

export const DEFAULT_WEBHOOK_URL = "https://webhook.site/test";
export const WEBHOOK_VERSION = "1.0.0";
export const USER_FRIENDLY_ERROR_MESSAGE =
  "Video creation failed. Please try again or contact support if the issue persists.";

export const WEBHOOK_FEATURES = [
  "User authentication",
  "Signature verification",
  "Custom payloads",
  "Error handling",
] as const;

export const VALID_AVATAR_STATUSES = ["completed", "failed"] as const;
export const VALID_VIDEO_STATUSES = ["completed", "failed", "processing"] as const;

