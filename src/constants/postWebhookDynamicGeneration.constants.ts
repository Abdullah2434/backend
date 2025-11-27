/**
 * Constants for Post Webhook Dynamic Generation Service
 */

// ==================== DEFAULT USER CONTEXT ====================
export const DEFAULT_USER_CONTEXT = {
  name: "Real Estate Professional",
  position: "Real Estate Professional",
  companyName: "Real Estate Company",
  city: "Your City",
  socialHandles: "@realestate",
} as const;

// ==================== PLATFORM MAPPINGS ====================
export const PLATFORM_CAPTION_MAPPINGS = {
  instagram: "instagram_caption",
  facebook: "facebook_caption",
  linkedin: "linkedin_caption",
  twitter: "twitter_caption",
  tiktok: "tiktok_caption",
  youtube: "youtube_caption",
} as const;

// ==================== WEBHOOK TYPES ====================
export const WEBHOOK_TYPES = {
  VIDEO: "video",
  CAPTION: "caption",
} as const;

export type WebhookType = typeof WEBHOOK_TYPES[keyof typeof WEBHOOK_TYPES];

