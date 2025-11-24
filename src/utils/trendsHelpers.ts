import { Request } from "express";
import AuthService from "../services/auth.service";
import {
  getUserExistingVideoTitles,
  filterExistingTrends,
} from "./videoHelpers";
import {
  MIN_TREND_COUNT,
  MAX_TREND_COUNT,
  SUPER_FAST_MAX_COUNT,
  FAST_MAX_COUNT,
  TEMPLATE_BASED_THRESHOLD,
  CONTENT_MODERATION_KEYWORDS,
  VALIDATION_ERROR_KEYWORDS,
} from "../constants/trends.constants";
import { ContentSafetyResult } from "../types/services/trends.types";

// ==================== CONTROLLER HELPER FUNCTIONS ====================

/**
 * Extract token from request headers
 */
export function extractToken(req: Request): string {
  return (req.headers.authorization || "").replace("Bearer ", "");
}

/**
 * Normalize and validate trend count based on mode
 */
export function getValidTrendCount(
  count: number,
  fast: boolean,
  super_fast: boolean
): number {
  let validCount = Math.min(Math.max(count, MIN_TREND_COUNT), MAX_TREND_COUNT);

  if (super_fast) {
    validCount = Math.min(validCount, SUPER_FAST_MAX_COUNT);
  } else if (fast) {
    validCount = Math.min(validCount, FAST_MAX_COUNT);
  }

  return validCount;
}

/**
 * Determine generation method based on count
 */
export function getGenerationMethod(count: number): string {
  return count <= TEMPLATE_BASED_THRESHOLD ? "Template-based" : "AI-generated";
}

/**
 * Check if error is a content moderation error
 */
export function isContentModerationError(errorMessage: string): boolean {
  return CONTENT_MODERATION_KEYWORDS.some((keyword) =>
    errorMessage.includes(keyword)
  );
}

/**
 * Check if error is a validation error
 */
export function isValidationError(errorMessage: string): boolean {
  return VALIDATION_ERROR_KEYWORDS.some((keyword) =>
    errorMessage.includes(keyword)
  );
}

/**
 * Format content moderation error response
 */
export function formatContentModerationError(errorMessage: string) {
  return {
    success: false,
    message: "Content contains inappropriate material",
    error: errorMessage,
    details: {
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
    },
  };
}

/**
 * Format validation error response
 */
export function formatValidationError(errorMessage: string) {
  return {
    success: false,
    message: "Description must be related to real estate topics.",
    error: errorMessage,
    details: {
      requirement:
        "The provided description must be related to one or more of the following categories:",
      categories: {
        "1. Real Estate": {
          definition:
            "Properties, homes, houses, apartments, condos, townhouses, commercial real estate, real estate market, property listings",
          examples: [
            "Luxury homes in Beverly Hills",
            "Commercial properties for sale",
            "Real estate investment opportunities",
          ],
        },
        "2. Property": {
          definition:
            "Buying, selling, renting, investing in properties, property management, property values, property transactions",
          examples: [
            "Buying your first home",
            "Investment properties for sale",
            "Property rental income",
          ],
        },
        "3. Housing": {
          definition:
            "Residential properties, housing market, homeownership, rental properties, housing trends, affordable housing",
          examples: [
            "First-time homebuyer programs",
            "Housing market trends",
            "Affordable housing options",
          ],
        },
        "4. Mortgages/Loans": {
          definition:
            "Mortgage loans, refinancing, home financing, loan products, interest rates, down payments, loan approval",
          examples: [
            "VA loan benefits",
            "Mortgage refinancing options",
            "FHA loan programs",
          ],
        },
        "5. Real Estate Professionals": {
          definition:
            "Real estate agents, brokers, loan officers, mortgage brokers, realtors, real estate services",
          examples: [
            "Find a real estate agent",
            "Loan officer services",
            "Real estate broker expertise",
          ],
        },
      },
      message:
        "Please provide a description that relates to any of these categories to generate keypoints.",
    },
  };
}

/**
 * Determine HTTP status code based on error message
 */
export function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

/**
 * Filter trends by existing user videos
 */
export async function filterTrendsByUserVideos(
  trends: any[],
  req: Request
): Promise<any[]> {
  try {
    const authService = new AuthService();
    const token = extractToken(req);

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

// ==================== SERVICE-LEVEL UTILITY FUNCTIONS ====================

/**
 * Extract JSON from text response
 */
export function extractJsonFromText(text: string): any {
  try {
    // Try to find JSON in the text
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // If no JSON found, try parsing the whole text
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to extract JSON from text: ${error}`);
  }
}

/**
 * Build city context string
 */
export function buildCityContext(city: string): string {
  return ` in ${city}`;
}

/**
 * Ensure minimum keypoints (at least 3)
 */
export function ensureMinimumKeypoints(keypoints: string): string {
  if (!keypoints || keypoints.trim().length === 0) {
    return "1. Property features\n2. Location benefits\n3. Investment potential";
  }

  const points = keypoints.split("\n").filter((p) => p.trim().length > 0);
  if (points.length < 3) {
    // Add default points if needed
    const defaultPoints = [
      "1. Property features",
      "2. Location benefits",
      "3. Investment potential",
    ];
    return [...points, ...defaultPoints.slice(points.length)].join("\n");
  }

  return keypoints;
}

/**
 * Normalize keypoints format
 */
export function normalizeKeypoints(keypoints: string | string[]): string {
  if (Array.isArray(keypoints)) {
    return keypoints.join("\n");
  }
  if (typeof keypoints === "string") {
    return keypoints;
  }
  return String(keypoints);
}

/**
 * Validate description with keywords
 */
export function validateWithKeywords(description: string): boolean {
  const realEstateKeywords = [
    "real estate",
    "property",
    "home",
    "house",
    "apartment",
    "condo",
    "rental",
    "mortgage",
    "loan",
    "housing",
    "realtor",
    "agent",
    "broker",
    "investment",
    "buy",
    "sell",
    "rent",
  ];

  const lowerDescription = description.toLowerCase();
  return realEstateKeywords.some((keyword) =>
    lowerDescription.includes(keyword)
  );
}

/**
 * Get city data (placeholder - can be enhanced with actual city data)
 */
export function getCityData(city: string): {
  name: string;
  state?: string;
  population?: number;
} | null {
  // This is a placeholder - can be enhanced with actual city database
  return {
    name: city,
  };
}

/**
 * Check for inappropriate content using keywords
 */
export function checkInappropriateContent(
  content: string
): ContentSafetyResult | null {
  const lowerContent = content.toLowerCase();
  const inappropriateKeywords = [
    "racism",
    "racist",
    "nudity",
    "nude",
    "vulgar",
    "profanity",
    "hate speech",
  ];

  const foundKeywords = inappropriateKeywords.filter((keyword) =>
    lowerContent.includes(keyword)
  );

  if (foundKeywords.length > 0) {
    let category = "inappropriate";
    if (foundKeywords.includes("racism") || foundKeywords.includes("racist")) {
      category = "racism";
    } else if (foundKeywords.includes("nudity") || foundKeywords.includes("nude")) {
      category = "nudity";
    } else if (foundKeywords.includes("vulgar") || foundKeywords.includes("profanity")) {
      category = "vulgar";
    }

    return {
      isSafe: false,
      category,
      reason: `Content contains inappropriate material: ${foundKeywords.join(", ")}`,
    };
  }

  return null;
}

/**
 * Process moderation result from OpenAI
 */
export function processModerationResult(
  moderationData: any
): ContentSafetyResult {
  if (!moderationData || !moderationData.results || !moderationData.results[0]) {
    return { isSafe: true };
  }

  const result = moderationData.results[0];
  const isFlagged = result.flagged === true;

  if (!isFlagged) {
    return { isSafe: true };
  }

  // Determine category from flagged categories
  let category = "inappropriate";
  if (result.categories?.hate) {
    category = "racism";
  } else if (result.categories?.["sexual/minors"]) {
    category = "nudity";
  } else if (result.categories?.violence) {
    category = "violence";
  }

  return {
    isSafe: false,
    category,
    reason: "Content flagged by moderation API",
  };
}
