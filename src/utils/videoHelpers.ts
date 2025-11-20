import Video from "../models/Video";
import mongoose from "mongoose";

/**
 * Normalize title/description for comparison
 * Converts to lowercase, trims whitespace, and removes extra spaces
 */
export function normalizeTitle(title: string): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // Replace multiple spaces with single space
}

/**
 * Get user's existing video titles (normalized)
 * Returns a Set of normalized video titles for efficient lookup
 * 
 * @param userId - User ID (preferred if available)
 * @param email - User email (fallback if userId not available)
 * @returns Set of normalized video titles
 */
export async function getUserExistingVideoTitles(
  userId?: string,
  email?: string
): Promise<Set<string>> {
  try {
    if (!userId && !email) {
      return new Set();
    }

    // Build query - prefer userId, fallback to email
    const query: any = {};
    if (userId) {
      // Convert string userId to ObjectId if valid
      if (mongoose.Types.ObjectId.isValid(userId)) {
        query.userId = new mongoose.Types.ObjectId(userId);
      } else {
        // If invalid ObjectId, fallback to email
        if (email) {
          query.email = email;
        } else {
          return new Set();
        }
      }
    } else if (email) {
      query.email = email;
    }

    // Query all videos for the user (all statuses)
    const videos = await Video.find(query).select("title").lean();

    // Normalize titles and create Set for O(1) lookup
    const normalizedTitles = new Set<string>();
    for (const video of videos) {
      if (video.title) {
        normalizedTitles.add(normalizeTitle(video.title));
      }
    }

    return normalizedTitles;
  } catch (error) {
    console.error("Error fetching user existing video titles:", error);
    return new Set(); // Return empty set on error to avoid breaking the flow
  }
}

/**
 * Filter trends to exclude those that already have videos created
 * 
 * @param trends - Array of trends with description field
 * @param existingTitles - Set of normalized video titles to exclude
 * @returns Filtered array of trends
 */
export function filterExistingTrends<T extends { description: string }>(
  trends: T[],
  existingTitles: Set<string>
): T[] {
  if (existingTitles.size === 0) {
    return trends; // No existing videos, return all trends
  }

  return trends.filter((trend) => {
    const normalizedDescription = normalizeTitle(trend.description);
    return !existingTitles.has(normalizedDescription);
  });
}

