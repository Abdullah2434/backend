/**
 * Helper functions for trends service
 */

import {
  TrendData,
  ContentSafetyResult,
  CityData,
} from "../types/services/trends.types";
import {
  CITY_DATA,
  DEFAULT_CITY_DATA,
  REAL_ESTATE_KEYWORDS,
  DEFAULT_KEYPOINTS,
  INAPPROPRIATE_PATTERNS,
  RELEVANT_MODERATION_CATEGORIES,
} from "../constants/trends.constants";

// ==================== JSON PARSING ====================
/**
 * Utility to robustly extract JSON from raw text responses,
 * including handling truncated arrays/objects and malformed JSON.
 */
export function extractJsonFromText(content: string): any {
  if (!content || typeof content !== "string") {
    throw new Error("No content to parse");
  }

  // Remove markdown fences and clean up
  let cleaned = content
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/\n\s*\n/g, "\n") // Remove empty lines
    .trim();

  // Try to find JSON array first
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    cleaned = arrayMatch[0];
  } else {
    // Extract only the JSON portion (between first {/[ and last }/])
    const firstIdx = Math.min(
      ...["{", "["].map((ch) =>
        cleaned.indexOf(ch) === -1
          ? Number.POSITIVE_INFINITY
          : cleaned.indexOf(ch)
      )
    );
    const lastIdx = Math.max(
      cleaned.lastIndexOf("}"),
      cleaned.lastIndexOf("]")
    );
    if (!isFinite(firstIdx) || lastIdx === -1) {
      throw new Error("No JSON object/array found in content");
    }
    cleaned = cleaned.slice(firstIdx, lastIdx + 1).trim();
  }

  // Fix common JSON issues
  let candidateFixed = cleaned
    .replace(/,\s*(?=[}\]])/g, "") // remove trailing commas
    .replace(/\n/g, " ") // replace newlines with spaces
    .replace(/\s+/g, " ") // normalize whitespace
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // quote unquoted keys
    .trim();

  try {
    return JSON.parse(candidateFixed);
  } catch (err) {
    // Try parsing the original candidate first
    try {
      return JSON.parse(cleaned);
    } catch (err2) {
      // Continue with fixes
    }

    // If array opened but not closed
    if (candidateFixed.startsWith("[") && !candidateFixed.endsWith("]")) {
      const lastCompleteObject = candidateFixed.lastIndexOf("}");
      if (lastCompleteObject > 0) {
        candidateFixed =
          candidateFixed.substring(0, lastCompleteObject + 1) + "]";
      } else {
        candidateFixed += "]";
      }
    }

    // If object opened but not closed
    if (candidateFixed.startsWith("{") && !candidateFixed.endsWith("}")) {
      candidateFixed += "}";
    }

    try {
      return JSON.parse(candidateFixed);
    } catch (err2) {
      // Try trimming to last complete object/array
      const lastValidIdx = Math.max(
        candidateFixed.lastIndexOf("}"),
        candidateFixed.lastIndexOf("]")
      );
      if (lastValidIdx > 0) {
        const trimmed = candidateFixed.slice(0, lastValidIdx + 1);
        try {
          return JSON.parse(trimmed);
        } catch (err3) {
          return [];
        }
      }

      return [];
    }
  }
}

// ==================== CITY DATA UTILITIES ====================
/**
 * Get city data by name
 */
export function getCityData(city: string): CityData {
  return CITY_DATA[city] || DEFAULT_CITY_DATA;
}

/**
 * Build city context string for prompts
 */
export function buildCityContext(city?: string): string {
  if (!city) return "";
  const cityInfo = getCityData(city);
  return ` for ${city} real estate market (${cityInfo.marketTrend}, ${cityInfo.priceRange})`;
}

// ==================== KEYPOINT VALIDATION ====================
/**
 * Validate and ensure minimum 3 keypoints
 */
export function ensureMinimumKeypoints(keypoints: string): string {
  const keypointArray = keypoints
    .split(",")
    .map((kp: string) => kp.trim())
    .filter((kp: string) => kp.length > 0);

  // If less than 3 keypoints, add default ones
  if (keypointArray.length < 3) {
    const needed = 3 - keypointArray.length;
    for (let i = 0; i < needed; i++) {
      keypointArray.push(DEFAULT_KEYPOINTS[i] || `Key point ${i + 1}`);
    }
  }

  return keypointArray.join(", ");
}

/**
 * Normalize keypoints from various formats
 */
export function normalizeKeypoints(keypoints: any): string {
  if (Array.isArray(keypoints)) {
    return keypoints.join(", ");
  }
  return keypoints || "";
}

// ==================== CONTENT SAFETY ====================
/**
 * Check for inappropriate content using keyword patterns
 */
export function checkInappropriateContent(
  content: string
): ContentSafetyResult | null {
  const normalizedContent = content.toLowerCase().trim();

  for (const [category, patterns] of Object.entries(INAPPROPRIATE_PATTERNS)) {
    for (const pattern of patterns) {
      // Reset regex lastIndex to avoid issues with global regex
      pattern.lastIndex = 0;
      if (pattern.test(normalizedContent)) {
        return {
          isSafe: false,
          reason: `Content contains inappropriate ${category} related content`,
          category: category,
        };
      }
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
  if (!moderationResult?.flagged) {
    return null;
  }

  const categories = moderationResult.categories || {};
  const flaggedCategories = Object.keys(categories).filter(
    (key) => categories[key] === true
  );

  const foundCategory = flaggedCategories.find((cat) =>
    RELEVANT_MODERATION_CATEGORIES.includes(cat)
  );

  if (foundCategory) {
    let category = "inappropriate";
    if (foundCategory.includes("hate")) category = "racism";
    else if (foundCategory.includes("sexual")) category = "nudity";
    else if (foundCategory.includes("violence")) category = "vulgar";

    return {
      isSafe: false,
      reason: `Content contains inappropriate ${category} related content`,
      category: category,
    };
  }

  return null;
}

// ==================== VALIDATION ====================
/**
 * Keyword-based validation for real estate descriptions
 */
export function validateWithKeywords(description: string): boolean {
  const lowerDescription = description.toLowerCase();
  return REAL_ESTATE_KEYWORDS.some((keyword) =>
    lowerDescription.includes(keyword)
  );
}

// ==================== ERROR HANDLING ====================
/**
 * Check if error is a content moderation error
 */
export function isContentModerationError(error: any): boolean {
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  return (
    errorMessage.includes("CONTENT_MODERATION_ERROR") ||
    errorMessage.includes("inappropriate") ||
    errorMessage.includes("racism") ||
    errorMessage.includes("nudity") ||
    errorMessage.includes("vulgar")
  );
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: any): boolean {
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  return (
    errorMessage.includes("not related to real estate") ||
    errorMessage.includes("not real estate related")
  );
}

/**
 * Format content moderation error message
 */
export function formatContentModerationError(category?: string): string {
  if (category === "racism") {
    return "CONTENT_MODERATION_ERROR: Content contains racist or discriminatory language. Please use respectful and inclusive language.";
  } else if (category === "nudity") {
    return "CONTENT_MODERATION_ERROR: Content contains inappropriate sexual or nudity-related content. Please keep content professional and appropriate.";
  } else {
    return "CONTENT_MODERATION_ERROR: Content contains inappropriate vulgar or offensive language. Please use professional and respectful language.";
  }
}

