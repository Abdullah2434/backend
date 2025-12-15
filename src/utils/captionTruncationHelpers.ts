/**
 * Helper functions for truncating social media captions to platform-specific limits
 */

import { SocialMediaCaptions } from "../types/captionGeneration.types";

// Platform-specific character limits
export const CAPTION_LIMITS = {
  instagram_caption: 2000,
  youtube_caption: 5000,
  tiktok_caption: 2200,
  linkedin_caption: 3000,
  facebook_caption: 5000,
  twitter_caption: 280,
} as const;

function truncateToWordBoundary(text: string, limit: number): string {
  if (text.length <= limit) return text;

  // Find last space before limit to avoid cutting words
  const slice = text.substring(0, limit);
  const lastSpace = slice.lastIndexOf(" ");

  // If no space found, hard cut at limit
  const trimmed = lastSpace > 0 ? slice.substring(0, lastSpace) : slice;

  // Add ellipsis only if we removed content and the text doesn't already end with punctuation
  const needsEllipsis = trimmed.length < text.length;
  const endsWithPunctuation = /[.!?]$/.test(trimmed.trim());

  if (needsEllipsis && !endsWithPunctuation) {
    return `${trimmed}...`;
  }

  return trimmed;
}

/**
 * Truncate social media captions to platform-specific character limits
 * Uses word-boundary truncation to avoid mid-word cuts and preserves null/undefined values
 * NOTE: Twitter/X captions are NOT truncated - AI generates summarized content ≤280 chars
 */
export function truncateSocialMediaCaptions(
  captions: Partial<SocialMediaCaptions>
): Partial<SocialMediaCaptions> {
  const truncated: Partial<SocialMediaCaptions> = {};

  for (const [key, limit] of Object.entries(CAPTION_LIMITS)) {
    const captionKey = key as keyof SocialMediaCaptions;
    const caption = captions[captionKey];

    if (caption === null || caption === undefined) {
      truncated[captionKey] = caption;
    } else if (typeof caption === "string") {
      // Skip truncation for Twitter/X - AI handles summarization
      if (key === "twitter_caption") {
        truncated[captionKey] = caption;
      } else {
        truncated[captionKey] =
          caption.length > limit
            ? truncateToWordBoundary(caption, limit)
            : caption;
      }
    }
  }

  return truncated;
}

