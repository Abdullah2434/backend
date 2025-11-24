import { Request, Response } from "express";
import {
  generateRealEstateTrends,
  generateCityBasedTrends,
  generateFromDescription,
} from "../services/trends.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateGetCityBasedTrends,
  validateGenerateContentFromDescription,
} from "../validations/trends.validations";
import {
  getValidTrendCount,
  getGenerationMethod,
  isContentModerationError,
  isValidationError,
  formatContentModerationError,
  formatValidationError,
  getErrorStatus,
  filterTrendsByUserVideos,
} from "../utils/trendsHelpers";
import {
  TOPIC_REAL_ESTATE,
  LOCATION_AMERICA,
} from "../constants/trends.constants";

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Get real estate trends
 * GET /api/trends/real-estate
 */
export const getRealEstateTrends = async (req: Request, res: Response) => {
  try {
    const trends = await generateRealEstateTrends();

    // Optionally filter out trends that already have videos (if user is authenticated)
    const filteredTrends = await filterTrendsByUserVideos(trends, req);

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
    const validationResult = validateGetCityBasedTrends(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { city, position, count, fast, super_fast } = validationResult.data!;

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
    const filteredTrends = await filterTrendsByUserVideos(trends, req);

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
    const validationResult = validateGenerateContentFromDescription(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { description, city } = validationResult.data!;

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
