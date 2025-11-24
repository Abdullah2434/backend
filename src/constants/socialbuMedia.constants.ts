/**
 * SocialBu Media service constants
 */

export const VALID_MEDIA_STATUSES = ["uploaded", "failed"] as const;
export const UPLOAD_STATUS_CHECK_DELAY_MS = 2000;
export const POST_CREATION_DELAY_MS = 1000;

/**
 * Account type mappings for captions
 */
export const ACCOUNT_TYPE_CAPTION_MAP: Record<string, string> = {
  "instagram.api": "instagram_caption",
  "facebook.profile": "facebook_caption",
  "facebook.page": "facebook_caption",
  "linkedin.profile": "linkedin_caption",
  "twitter.profile": "twitter_caption",
  "tiktok.profile": "tiktok_caption",
  "google.youtube": "youtube_caption",
};

