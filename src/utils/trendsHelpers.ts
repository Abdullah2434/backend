/**
 * Helper functions for trends controller and service
 */

import AuthService from "../services/auth.service";
import {
  getUserExistingVideoTitles,
  filterExistingTrends,
} from "./videoHelpers";
import { Request } from "express";
import {
  CITY_DATA,
  DEFAULT_CITY_DATA,
  REAL_ESTATE_KEYWORDS,
  INAPPROPRIATE_PATTERNS,
  CONTENT_MODERATION_KEYWORDS,
  VALIDATION_ERROR_KEYWORDS,
  RELEVANT_MODERATION_CATEGORIES,
} from "../constants/trends.constants";
import { CityData, ContentSafetyResult } from "../types/services/trends.types";

/**
 * Filter trends by existing user videos (if authenticated)
 */
export async function filterTrendsByExistingVideos(
  trends: any[],
  req: Request
): Promise<any[]> {
  try {
    const authService = new AuthService();
    const token = (req.headers.authorization || "").replace("Bearer ", "");

    if (!token) {
      return trends;
    }

    const user = await authService.getCurrentUser(token);
    if (!user) {
      return trends;
    }

    // Get user's existing video titles
    const existingTitles = await getUserExistingVideoTitles(
      user._id.toString(),
      user.email
    );

    // Filter out trends that match existing videos
    return filterExistingTrends(trends, existingTitles);
  } catch (authError) {
    // If auth fails, just return all trends (don't break the API)
    console.warn("Could not filter trends by existing videos:", authError);
    return trends;
  }
}

/**
 * Extract JSON from text (handles markdown code blocks and plain JSON)
 */
export function extractJsonFromText(text: string): any {
  if (!text || typeof text !== "string") {
    return null;
    }

  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Fall through to try other methods
    }
  }

  // Try to find JSON object or array in the text
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
        try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      // Fall through
  }
}

  // Try parsing the entire text as JSON
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

/**
 * Build city context string for prompts
 */
export function buildCityContext(city: string): string {
  const cityData = getCityData(city);
  if (!cityData) {
    return "";
  }

  const contextParts: string[] = [];
  if (cityData.neighborhoods && cityData.neighborhoods.length > 0) {
    contextParts.push(`neighborhoods: ${cityData.neighborhoods.slice(0, 3).join(", ")}`);
  }
  if (cityData.priceRange) {
    contextParts.push(`price range: ${cityData.priceRange}`);
  }
  if (cityData.marketTrend) {
    contextParts.push(`market: ${cityData.marketTrend}`);
  }

  return contextParts.length > 0 ? ` for ${city} (${contextParts.join(", ")})` : ` for ${city}`;
}

/**
 * Get city data by name
 */
export function getCityData(city: string): CityData | null {
  if (!city || typeof city !== "string") {
    return null;
}

  const normalizedCity = city.trim();
  return CITY_DATA[normalizedCity] || DEFAULT_CITY_DATA;
}

/**
 * Ensure minimum keypoints (at least 3, comma-separated)
 */
export function ensureMinimumKeypoints(keypoints: string): string {
  if (!keypoints || typeof keypoints !== "string") {
    return "Market insights, Expert guidance, Local expertise";
  }

  const points = keypoints
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (points.length >= 3) {
    return points.join(", ");
  }

  // Pad with default keypoints if needed
  const defaultPoints = ["Market insights", "Expert guidance", "Local expertise"];
  const needed = 3 - points.length;
  const padded = [...points, ...defaultPoints.slice(0, needed)];

  return padded.join(", ");
}

/**
 * Normalize keypoints string (clean up formatting)
 */
export function normalizeKeypoints(keypoints: string): string {
  if (!keypoints || typeof keypoints !== "string") {
    return "";
  }

  return keypoints
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(", ");
}

/**
 * Validate content with real estate keywords
 */
export function validateWithKeywords(description: string): boolean {
  if (!description || typeof description !== "string") {
    return false;
  }

  const lowerDescription = description.toLowerCase();
  return REAL_ESTATE_KEYWORDS.some((keyword) =>
    lowerDescription.includes(keyword.toLowerCase())
  );
}

/**
 * Check if error is a content moderation error
 */
export function isContentModerationError(errorMessage: string | Error): boolean {
  const message =
    errorMessage instanceof Error ? errorMessage.message : String(errorMessage);
  return CONTENT_MODERATION_KEYWORDS.some((keyword) =>
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Check if error is a validation error
 */
export function isValidationError(errorMessage: string | Error): boolean {
  const message =
    errorMessage instanceof Error ? errorMessage.message : String(errorMessage);
  return VALIDATION_ERROR_KEYWORDS.some((keyword) =>
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Format content moderation error response
 */
export function formatContentModerationError(errorMessage: string): Error {
  const error = new Error("CONTENT_MODERATION_ERROR");
  (error as any).details = {
    restriction:
      "Content must be free of racism, nudity, and vulgar language",
    requirement:
      "Please use professional and respectful language appropriate for a real estate platform",
    categories: {
      Racism:
        "Content must not contain racist, discriminatory, or hate speech",
      Nudity: "Content must not contain sexual or explicit content",
      Vulgar: "Content must not contain profanity or offensive language",
    },
    message:
      "Please revise your content to remove any inappropriate material and try again.",
    originalError: errorMessage,
  };
  return error;
}

/**
 * Check for inappropriate content using keyword patterns
 */
export function checkInappropriateContent(
  content: string
): ContentSafetyResult | null {
  if (!content || typeof content !== "string") {
    return null;
  }

  // Check for racism
  for (const pattern of INAPPROPRIATE_PATTERNS.racism) {
    if (pattern.test(content)) {
      return {
        isSafe: false,
        category: "racism",
        reason: "Content contains potentially racist language",
      };
    }
  }

  // Check for nudity
  for (const pattern of INAPPROPRIATE_PATTERNS.nudity) {
    if (pattern.test(content)) {
        return {
          isSafe: false,
        category: "nudity",
        reason: "Content contains potentially explicit sexual content",
      };
    }
  }

  // Check for vulgar language
  for (const pattern of INAPPROPRIATE_PATTERNS.vulgar) {
    if (pattern.test(content)) {
      return {
        isSafe: false,
        category: "vulgar",
        reason: "Content contains potentially vulgar or offensive language",
        };
    }
  }

  return null;
}

/**
 * Process OpenAI moderation result
 */
export function processModerationResult(
  moderationResult: any
): ContentSafetyResult | null {
  if (!moderationResult || !moderationResult.categories) {
    return null;
  }

  // Check relevant categories
  for (const category of RELEVANT_MODERATION_CATEGORIES) {
    if (moderationResult.categories[category] === true) {
    return {
      isSafe: false,
      category: category,
        reason: `Content flagged by OpenAI moderation: ${category}`,
    };
    }
  }

  return null;
}
