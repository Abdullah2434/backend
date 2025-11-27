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
import {
  formatValidationErrors,
  handleControllerError,
} from "../utils/controllerHelpers";
import { filterTrendsByExistingVideos } from "../utils/trendsHelpers";
import {
  MIN_TREND_COUNT,
  MAX_TREND_COUNT,
  SUPER_FAST_MAX_COUNT,
  FAST_MAX_COUNT,
  TEMPLATE_BASED_THRESHOLD,
  TOPIC_REAL_ESTATE,
  LOCATION_AMERICA,
  CONTENT_MODERATION_KEYWORDS,
  VALIDATION_ERROR_KEYWORDS,
} from "../constants/trends.constants";

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
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Check if error is a validation error
 */
function isValidationError(errorMessage: string): boolean {
  return VALIDATION_ERROR_KEYWORDS.some((keyword) =>
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
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


// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Get real estate trends
 * GET /api/trends/real-estate
 */
export const getRealEstateTrends = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const trends = await generateRealEstateTrends();

    // Optionally filter out trends that already have videos (if user is authenticated)
    const filteredTrends = await filterTrendsByExistingVideos(trends, req);

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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "getRealEstateTrends",
      "Failed to generate real estate trends"
    );
  }
};

/**
 * Get city-based trends
 * POST /api/trends/city-based
 */
export const getCityBasedTrends = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Validate request body
    const validationResult = getCityBasedTrendsSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
    const filteredTrends = await filterTrendsByExistingVideos(trends, req);

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
  } catch (error) {
    const city = req.body?.city || "unknown";
    const position = req.body?.position || "unknown";
    return handleControllerError(
      error,
      res,
      "getCityBasedTrends",
      `Failed to generate real estate trends for ${city} (${position})`
    );
  }
};

/**
 * Generate content from description
 * POST /api/trends/from-description
 */
export const generateContentFromDescription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Validate request body
    const validationResult = generateContentFromDescriptionSchema.safeParse(
      req.body
    );
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
  } catch (error) {
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
    return handleControllerError(
      error,
      res,
      "generateContentFromDescription",
      "Failed to generate content from description"
    );
  }
};
