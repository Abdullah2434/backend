/**
 * Helper functions for Post Webhook Dynamic Generation Service
 */

import UserVideoSettings from "../models/UserVideoSettings";
import { DEFAULT_USER_CONTEXT, PLATFORM_CAPTION_MAPPINGS } from "../constants/postWebhookDynamicGeneration.constants";

// ==================== USER CONTEXT TYPES ====================
export interface UserContext {
  name: string;
  position: string;
  companyName: string;
  city: string;
  socialHandles: string;
}

// ==================== CAPTIONS TYPE ====================
export interface SocialMediaCaptions {
  instagram_caption: string;
  facebook_caption: string;
  linkedin_caption: string;
  twitter_caption: string;
  tiktok_caption: string;
  youtube_caption: string;
}

// ==================== USER CONTEXT HELPERS ====================
/**
 * Get user context from UserVideoSettings
 */
export async function getUserContextFromSettings(
  email: string
): Promise<UserContext> {
  try {
    const userSettings = await UserVideoSettings.findOne({ email });
    if (userSettings) {
      return {
        name: userSettings.name,
        position: userSettings.position,
        companyName: userSettings.companyName,
        city: userSettings.city,
        socialHandles: userSettings.socialHandles,
      };
    }
  } catch (error) {
    // Fallback to defaults if error
  }

  return { ...DEFAULT_USER_CONTEXT };
}

// ==================== CAPTION CONVERSION HELPERS ====================
/**
 * Convert dynamic posts array to traditional caption format
 */
export function convertDynamicPostsToCaptions(
  dynamicPosts: Array<{ platform: string; content: string }>
): SocialMediaCaptions {
  const captions: SocialMediaCaptions = {
    instagram_caption: "",
    facebook_caption: "",
    linkedin_caption: "",
    twitter_caption: "",
    tiktok_caption: "",
    youtube_caption: "",
  };

  for (const post of dynamicPosts) {
    const captionKey = PLATFORM_CAPTION_MAPPINGS[
      post.platform as keyof typeof PLATFORM_CAPTION_MAPPINGS
    ] as keyof SocialMediaCaptions;

    if (captionKey) {
      captions[captionKey] = post.content || "";
    }
  }

  return captions;
}

/**
 * Get caption for a specific platform from dynamic posts
 */
export function getCaptionForPlatform(
  dynamicPosts: Array<{ platform: string; content: string }>,
  platform: string
): string {
  const post = dynamicPosts.find((p) => p.platform === platform);
  return post?.content || "";
}

