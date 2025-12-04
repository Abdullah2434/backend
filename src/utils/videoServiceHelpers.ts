/**
 * Helper functions for Video Service
 */

import crypto from "crypto";
import {
  DEFAULT_USER_NAME,
  DEFAULT_USER_POSITION,
  DEFAULT_COMPANY_NAME,
  DEFAULT_CITY,
  DEFAULT_SOCIAL_HANDLES,
  VIDEO_ID_PREFIX,
  SECRET_KEY_BYTES,
  VIDEO_ID_RANDOM_BYTES,
} from "../constants/videoService.constants";

/**
 * Generate a unique video ID
 */
export function generateVideoId(): string {
  return `${VIDEO_ID_PREFIX}${Date.now()}_${crypto
    .randomBytes(VIDEO_ID_RANDOM_BYTES)
    .toString("hex")}`;
}

/**
 * Generate a secret key for video encryption
 */
export function generateSecretKey(): string {
  return crypto.randomBytes(SECRET_KEY_BYTES).toString("hex");
}

/**
 * Clean and normalize a video title
 */
export function cleanVideoTitle(title: string): string {
  return title
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Extract filename from URL
 */
export function extractFilenameFromUrl(
  url: string,
  videoId: string
): string {
  const urlParts = url.split("/");
  return urlParts[urlParts.length - 1] || `${videoId}.mp4`;
}

/**
 * Build user context from settings with defaults
 */
export function buildUserContextFromSettings(
  userSettings: any
): {
  name: string;
  position: string;
  companyName: string;
  city: string;
  socialHandles: string;
} {
  return {
    name: userSettings?.name || DEFAULT_USER_NAME,
    position: userSettings?.position || DEFAULT_USER_POSITION,
    companyName: userSettings?.companyName || DEFAULT_COMPANY_NAME,
    city: userSettings?.city || DEFAULT_CITY,
    socialHandles: userSettings?.socialHandles || DEFAULT_SOCIAL_HANDLES,
  };
}

/**
 * Generate captions for a video
 */
export async function generateCaptionsForVideo(
  videoTitle: string,
  userSettings: any,
  language?: string
): Promise<{
  instagram_caption?: string;
  facebook_caption?: string;
  linkedin_caption?: string;
  twitter_caption?: string;
  tiktok_caption?: string;
  youtube_caption?: string;
}> {
  const { CaptionGenerationService } = await import("../services/content");
  const userContext = buildUserContextFromSettings(userSettings);

  return await CaptionGenerationService.generateCaptions(
    videoTitle,
    videoTitle,
    userContext,
    language
  );
}

/**
 * Check if video captions are missing
 */
export function areCaptionsMissing(socialMediaCaptions: any): boolean {
  return (
    !socialMediaCaptions ||
    !socialMediaCaptions.instagram_caption ||
    !socialMediaCaptions.facebook_caption ||
    !socialMediaCaptions.linkedin_caption ||
    !socialMediaCaptions.twitter_caption ||
    !socialMediaCaptions.tiktok_caption ||
    !socialMediaCaptions.youtube_caption
  );
}

/**
 * Check if youtube caption is missing
 */
export function isYoutubeCaptionMissing(socialMediaCaptions: any): boolean {
  return !socialMediaCaptions?.youtube_caption;
}

