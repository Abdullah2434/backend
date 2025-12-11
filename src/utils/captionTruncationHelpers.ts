/**
 * Helper functions for truncating social media captions to platform-specific limits
 */

import { SocialMediaCaptions } from "../types/captionGeneration.types";

// Platform-specific character limits
const CAPTION_LIMITS = {
  instagram_caption: 2000,
  youtube_caption: 5000,
  tiktok_caption: 2200,
  linkedin_caption: 3000,
  facebook_caption: 5000,
  twitter_caption: 280,
} as const;

/**
 * Truncate social media captions to platform-specific character limits
 * Preserves null/undefined values and only truncates if caption exceeds limit
 */
export function truncateSocialMediaCaptions(
  captions: Partial<SocialMediaCaptions>
): Partial<SocialMediaCaptions> {
  const truncated: Partial<SocialMediaCaptions> = {};

  // Process each caption type
  for (const [key, limit] of Object.entries(CAPTION_LIMITS)) {
    const captionKey = key as keyof SocialMediaCaptions;
    const caption = captions[captionKey];

    if (caption === null || caption === undefined) {
      // Preserve null/undefined values
      truncated[captionKey] = caption;
    } else if (typeof caption === "string") {
      // Truncate if exceeds limit
      truncated[captionKey] =
        caption.length > limit ? caption.substring(0, limit) : caption;
    }
  }

  return truncated;
}

