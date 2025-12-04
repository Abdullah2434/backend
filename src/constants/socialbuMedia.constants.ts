/**
 * Constants for SocialBu media controller
 */

// ==================== MEDIA STATUS ====================
export const VALID_MEDIA_STATUSES = ["uploaded", "failed"] as const;

// ==================== DELAYS ====================
export const UPLOAD_STATUS_CHECK_DELAY_MS = 2000;
export const POST_CREATION_DELAY_MS = 1000;

// ==================== ACCOUNT TYPE MAPPINGS ====================
export const ACCOUNT_TYPE_CAPTION_MAP: Record<string, string> = {
  "instagram.api": "instagram_caption",
  "facebook.profile": "facebook_caption",
  "facebook.page": "facebook_caption",
  "linkedin.profile": "linkedin_caption",
  "twitter.profile": "twitter_caption",
  "tiktok.profile": "tiktok_caption",
  "google.youtube": "youtube_caption",
};

