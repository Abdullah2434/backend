import { Request, Response } from "express";
import {
  generateRealEstateTrends,
  generateCityBasedTrends,
  generateFromDescription,
} from "../services/content";
import { ResponseHelper } from "../utils/responseHelper";
import {
  getCityBasedTrendsSchema,
  generateContentFromDescriptionSchema,
} from "../validations/trends.validations";
import AuthService from "../services/auth.service";
import {
  getUserExistingVideoTitles,
  filterExistingTrends,
} from "../utils/videoHelpers";

// ==================== CONSTANTS ====================
const DEFAULT_TREND_COUNT = 10;
const MIN_TREND_COUNT = 1;
const MAX_TREND_COUNT = 20;
const SUPER_FAST_MAX_COUNT = 3;
const FAST_MAX_COUNT = 5;
const TEMPLATE_BASED_THRESHOLD = 5;

const TOPIC_REAL_ESTATE = "real_estate";
const LOCATION_AMERICA = "America";

// Content moderation error keywords
const CONTENT_MODERATION_KEYWORDS = [
  "CONTENT_MODERATION_ERROR",
  "inappropriate",
  "racism",
  "nudity",
  "vulgar",
];

// Validation error keywords
const VALIDATION_ERROR_KEYWORDS = [
  "VALIDATION_ERROR",
  "not related to real estate",
  "not real estate related",
];

// ==================== HELPER FUNCTIONS ====================
/**
 * Normalize and validate trend count based on mode
 */
function getValidTrendCount(
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
function getGenerationMethod(count: number): string {
  return count <= TEMPLATE_BASED_THRESHOLD ? "Template-based" : "AI-generated";
}

/**
 * Check if error is a content moderation error
 */
function isContentModerationError(errorMessage: string): boolean {
  return CONTENT_MODERATION_KEYWORDS.some((keyword) =>
    errorMessage.includes(keyword)
  );
}

/**
 * Check if error is a validation error
 */
function isValidationError(errorMessage: string): boolean {
  return VALIDATION_ERROR_KEYWORDS.some((keyword) =>
    errorMessage.includes(keyword)
  );
}

/**
 * Format content moderation error response
 */
function formatContentModerationError(errorMessage: string) {
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
function formatValidationError(errorMessage: string) {
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
function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Get real estate trends
 * GET /api/trends/real-estate
 */
export const getRealEstateTrends = async (req: Request, res: Response) => {
  try {
    const trends = await generateRealEstateTrends();

    // Optionally filter out trends that already have videos (if user is authenticated)
    let filteredTrends = trends;
    try {
      const authService = new AuthService();
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      
      if (token) {
        const user = await authService.getCurrentUser(token);
        if (user) {
          // Get user's existing video titles
          const existingTitles = await getUserExistingVideoTitles(
            user._id.toString(),
            user.email
          );
          
          // Filter out trends that match existing videos
          filteredTrends = filterExistingTrends(trends, existingTitles);
        }
      }
    } catch (authError) {
      // If auth fails, just return all trends (don't break the API)
      console.warn("Could not filter trends by existing videos:", authError);
    }

    return ResponseHelper.success(
      res,
      "Real estate trends generated successfully",
      {
        topic: TOPIC_REAL_ESTATE,
        location: LOCATION_AMERICA,
        trends: filteredTrends,
        count: filteredTrends.length,
      }
    );
  } catch (error: any) {
    console.error("Error in getRealEstateTrends:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to generate real estate trends",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get city-based trends
 * POST /api/trends/city-based
 */
export const getCityBasedTrends = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = getCityBasedTrendsSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { city, position, count, fast, super_fast } = validationResult.data;

    // Normalize inputs
    const normalizedPosition = String(position).trim();
    const normalizedCity = String(city).trim();
    const validCount = getValidTrendCount(count, fast, super_fast);

    // Generate trends
    const startTime = Date.now();
    const trends = await generateCityBasedTrends(
      normalizedCity,
      normalizedPosition,
      validCount
    );
    const endTime = Date.now();

    // Optionally filter out trends that already have videos (if user is authenticated)
    let filteredTrends = trends;
    try {
      const authService = new AuthService();
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      
      if (token) {
        const user = await authService.getCurrentUser(token);
        if (user) {
          // Get user's existing video titles
          const existingTitles = await getUserExistingVideoTitles(
            user._id.toString(),
            user.email
          );
          
          // Filter out trends that match existing videos
          filteredTrends = filterExistingTrends(trends, existingTitles);
        }
      }
    } catch (authError) {
      // If auth fails, just return all trends (don't break the API)
      console.warn("Could not filter trends by existing videos:", authError);
    }

    return ResponseHelper.success(
      res,
      `Real estate trends for ${normalizedCity} (${normalizedPosition}) generated successfully`,
      {
        topic: TOPIC_REAL_ESTATE,
        location: normalizedCity,
        position: normalizedPosition,
        trends: filteredTrends,
        count: filteredTrends.length,
        city: normalizedCity,
        processing_time_ms: endTime - startTime,
        cached: trends.length > 0 ? "Cache hit" : "Fresh generation",
        fast_mode: fast,
        super_fast_mode: super_fast,
        generation_method: getGenerationMethod(validCount),
      }
    );
  } catch (error: any) {
    console.error("Error in getCityBasedTrends:", error);
    const status = getErrorStatus(error);
    const city = req.body?.city || "unknown";
    const position = req.body?.position || "unknown";
    return res.status(status).json({
      success: false,
      message: `Failed to generate real estate trends for ${city} (${position})`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Generate content from description
 * POST /api/trends/from-description
 */
export const generateContentFromDescription = async (
  req: Request,
  res: Response
) => {
  try {
    // Validate request body
    const validationResult = generateContentFromDescriptionSchema.safeParse(
      req.body
    );
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { description, city } = validationResult.data;

    // Generate content
    const startTime = Date.now();
    const content = await generateFromDescription(description, city);
    const endTime = Date.now();

    return ResponseHelper.success(
      res,
      "Content generated successfully from description",
      {
        ...content,
        processing_time_ms: endTime - startTime,
        city: city || null,
        generation_method: "AI-generated",
      }
    );
  } catch (error: any) {
    console.error("Error in generateContentFromDescription:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Handle content moderation errors
    if (isContentModerationError(errorMessage)) {
      return res.status(400).json(formatContentModerationError(errorMessage));
    }

    // Handle validation errors (description not real estate related)
    if (isValidationError(errorMessage)) {
      return res.status(400).json(formatValidationError(errorMessage));
    }

    // Handle other errors
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: "Failed to generate content from description",
      error: errorMessage,
    });
  }
};
