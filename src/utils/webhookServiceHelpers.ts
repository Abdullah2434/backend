/**
 * Helper functions for Webhook Service
 */

import UserVideoSettings from "../models/UserVideoSettings";
import PendingCaptions from "../models/PendingCaptions";
import { generateFromDescription } from "../services/content";

// ==================== KEYPOINTS GENERATION ====================
/**
 * Generate keypoints from video title/description
 */
export async function generateKeypointsFromTitle(
  title: string,
  email: string
): Promise<void> {
  try {
    // Get city from UserVideoSettings using email
    const userSettings = await UserVideoSettings.findOne({ email });
    const videoCity = userSettings?.city || undefined;

    // Call generateFromDescription API with video title as description
    const keypointsResult = await generateFromDescription(title, videoCity);

    if (keypointsResult?.keypoints) {
      // Update PendingCaptions with generated keypoints
      await PendingCaptions.findOneAndUpdate(
        {
          email: email,
          title: title,
        },
        {
          keypoints: keypointsResult.keypoints,
        },
        { upsert: true, new: true }
      );
    }
  } catch (error) {
    // Don't fail the webhook if keypoints generation fails
    // Error is silently handled as this is a non-critical operation
  }
}

// ==================== SCHEDULED VIDEO HELPERS ====================
/**
 * Extract captions from schedule trend
 */
export function extractCaptionsFromTrend(trend: any): {
  instagram_caption: string;
  facebook_caption: string;
  linkedin_caption: string;
  twitter_caption: string;
  tiktok_caption: string;
  youtube_caption: string;
} {
  return {
    instagram_caption: trend.instagram_caption || "",
    facebook_caption: trend.facebook_caption || "",
    linkedin_caption: trend.linkedin_caption || "",
    twitter_caption: trend.twitter_caption || "",
    tiktok_caption: trend.tiktok_caption || "",
    youtube_caption: trend.youtube_caption || "",
  };
}

