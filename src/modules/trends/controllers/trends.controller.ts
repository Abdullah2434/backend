import { Response } from "express";
import TrendsService from "../services/trends.service";
import { TrendsRequest, TrendsResponse } from "../types/trends.types";
import {
  logTrendsError,
  sendResponse,
  formatTrendsResponse,
} from "../utils/trends.utils";

const trendsService = new TrendsService();

// ==================== TREND GENERATION CONTROLLERS ====================

export const getRealEstateTrends = async (
  req: TrendsRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await trendsService.generateRealEstateTrends();

    if (result.success) {
      const response = formatTrendsResponse({
        topic: "real_estate",
        location: "America",
        trends: result.trends,
        metadata: result.metadata,
      });

      sendResponse(res, 200, response.message, response.data);
    } else {
      sendResponse(res, 500, "Failed to generate real estate trends");
    }
  } catch (error: any) {
    logTrendsError(error, { action: "getRealEstateTrends" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to generate real estate trends"
    );
  }
};

export const generateTrends = async (
  req: TrendsRequest,
  res: Response
): Promise<void> => {
  try {
    const { topic, location, category, limit, filters } = req.body;

    const request = {
      topic,
      location,
      category,
      limit,
      filters,
    };

    const result = await trendsService.generateTrends(request);

    if (result.success) {
      const response = formatTrendsResponse({
        topic: request.topic,
        location: request.location || "global",
        trends: result.trends,
        metadata: result.metadata,
      });

      sendResponse(res, 200, response.message, response.data);
    } else {
      sendResponse(res, 500, "Failed to generate trends");
    }
  } catch (error: any) {
    logTrendsError(error, { action: "generateTrends" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to generate trends"
    );
  }
};

// ==================== UTILITY CONTROLLERS ====================

export const getTrendCategories = async (
  req: TrendsRequest,
  res: Response
): Promise<void> => {
  try {
    const categories = trendsService.getTrendCategories();

    sendResponse(res, 200, "Trend categories retrieved successfully", {
      categories,
      count: categories.length,
    });
  } catch (error: any) {
    logTrendsError(error, { action: "getTrendCategories" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to get trend categories"
    );
  }
};

export const validateTrendRequest = async (
  req: TrendsRequest,
  res: Response
): Promise<void> => {
  try {
    const { topic, location, category, limit, filters } = req.body;

    const request = {
      topic,
      location,
      category,
      limit,
      filters,
    };

    const isValid = trendsService.validateTrendRequest(request);

    sendResponse(res, 200, "Trend request validation completed", {
      isValid,
      request,
    });
  } catch (error: any) {
    logTrendsError(error, { action: "validateTrendRequest" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to validate trend request"
    );
  }
};

// ==================== HEALTH CHECK CONTROLLER ====================

export const healthCheck = async (
  req: TrendsRequest,
  res: Response
): Promise<void> => {
  try {
    const health = await trendsService.healthCheck();

    sendResponse(res, 200, "Health check completed", health);
  } catch (error: any) {
    logTrendsError(error, { action: "healthCheck" });
    sendResponse(res, 500, "Health check failed");
  }
};
