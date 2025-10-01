import { Response } from "express";
import { TrendsError, TrendsResponse } from "../types/trends.types";

// ==================== LOGGING UTILITIES ====================

export const logTrendsEvent = (event: string, data?: any): void => {
  const timestamp = new Date().toISOString();
  console.log(
    `[TRENDS] ${timestamp} - ${event}`,
    data ? JSON.stringify(data, null, 2) : ""
  );
};

export const logTrendsError = (error: Error, context?: any): void => {
  const timestamp = new Date().toISOString();
  console.error(
    `[TRENDS ERROR] ${timestamp} - ${error.name}: ${error.message}`,
    {
      stack: error.stack,
      context,
    }
  );
};

// ==================== RESPONSE UTILITIES ====================

export const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: any
): void => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data,
  });
};

// ==================== ERROR HANDLING ====================

export class TrendsErrorHandler {
  static handle(error: Error, context?: any): TrendsError {
    logTrendsError(error, context);

    if (error.name === "TrendsError") {
      return error as TrendsError;
    }

    return new TrendsError(error.message || "Internal server error");
  }

  static sendErrorResponse(res: Response, error: Error, context?: any): void {
    const trendsError = this.handle(error, context);
    sendResponse(res, trendsError.statusCode, trendsError.message);
  }
}

// ==================== DATA FORMATTING ====================

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const formatTrendData = (trend: any): any => {
  return {
    id: trend.id || generateId(),
    title: trend.title || "Untitled Trend",
    description: trend.description || "",
    category: trend.category || "general",
    location: trend.location || "global",
    timestamp: formatDate(new Date()),
    source: trend.source || "api",
    confidence: Math.min(Math.max(trend.confidence || 0.5, 0), 1),
    tags: Array.isArray(trend.tags) ? trend.tags : [],
    metadata: trend.metadata || {},
  };
};

export const generateId = (): string => {
  return `trend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ==================== VALIDATION UTILITIES ====================

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, "").replace(/\s+/g, " ");
};

export const sanitizeObject = (obj: any): any => {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
};

// ==================== CONFIGURATION UTILITIES ====================

export const getTrendsConfig = () => {
  return {
    apiKey: process.env.TRENDS_API_KEY || "",
    apiUrl: process.env.TRENDS_API_URL || "https://api.trends.com",
    defaultLocation: process.env.TRENDS_DEFAULT_LOCATION || "America",
    defaultLimit: parseInt(process.env.TRENDS_DEFAULT_LIMIT || "10"),
    enableCaching: process.env.TRENDS_ENABLE_CACHING === "true",
    cacheExpiry: parseInt(process.env.TRENDS_CACHE_EXPIRY || "3600000"), // 1 hour
    rateLimitWindow: parseInt(process.env.TRENDS_RATE_LIMIT_WINDOW || "60000"), // 1 minute
    rateLimitMax: parseInt(process.env.TRENDS_RATE_LIMIT_MAX || "100"),
  };
};

// ==================== HASHING UTILITIES ====================

export const generateTrendsHash = (data: any): string => {
  const crypto = require("crypto");
  const str = JSON.stringify(data);
  return crypto.createHash("md5").update(str).digest("hex");
};

// ==================== RESPONSE FORMATTING ====================

export const formatTrendsResponse = (data: any): any => {
  return {
    success: true,
    message: "Trends generated successfully",
    data: {
      topic: data.topic || "general",
      location: data.location || "global",
      trends: Array.isArray(data.trends)
        ? data.trends.map(formatTrendData)
        : [],
      count: Array.isArray(data.trends) ? data.trends.length : 0,
      generatedAt: formatDate(new Date()),
      metadata: data.metadata || {},
    },
  };
};

// ==================== CATEGORY UTILITIES ====================

export const getCategoryName = (category: string): string => {
  const categoryNames: Record<string, string> = {
    real_estate: "Real Estate",
    technology: "Technology",
    finance: "Finance",
    healthcare: "Healthcare",
    education: "Education",
    entertainment: "Entertainment",
    sports: "Sports",
    politics: "Politics",
    environment: "Environment",
    business: "Business",
  };

  return categoryNames[category] || category;
};

export const getValidCategories = (): string[] => {
  return [
    "real_estate",
    "technology",
    "finance",
    "healthcare",
    "education",
    "entertainment",
    "sports",
    "politics",
    "environment",
    "business",
  ];
};

// ==================== LOCATION UTILITIES ====================

export const getLocationName = (location: string): string => {
  const locationNames: Record<string, string> = {
    america: "America",
    usa: "United States",
    canada: "Canada",
    mexico: "Mexico",
    europe: "Europe",
    asia: "Asia",
    africa: "Africa",
    australia: "Australia",
    global: "Global",
  };

  return locationNames[location.toLowerCase()] || location;
};

// ==================== PROCESSING UTILITIES ====================

export const calculateProcessingTime = (startTime: number): number => {
  return Date.now() - startTime;
};

export const formatProcessingTime = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    return `${(ms / 60000).toFixed(2)}m`;
  }
};

// ==================== CACHE UTILITIES ====================

export const generateCacheKey = (
  topic: string,
  location?: string,
  category?: string
): string => {
  const parts = [topic];
  if (location) parts.push(location);
  if (category) parts.push(category);
  return `trends:${parts.join(":")}`;
};

export const isCacheValid = (cacheData: any, expiry: number): boolean => {
  if (!cacheData || !cacheData.expiresAt) return false;
  return new Date(cacheData.expiresAt) > new Date();
};

// ==================== STATISTICS UTILITIES ====================

export const calculateTrendStats = (trends: any[]): any => {
  const total = trends.length;
  const byCategory: Record<string, number> = {};
  const byLocation: Record<string, number> = {};

  trends.forEach((trend) => {
    byCategory[trend.category] = (byCategory[trend.category] || 0) + 1;
    byLocation[trend.location] = (byLocation[trend.location] || 0) + 1;
  });

  return {
    total,
    categories: byCategory,
    locations: byLocation,
    lastUpdated: formatDate(new Date()),
  };
};

// ==================== ERROR UTILITIES ====================

export const isRetryableError = (error: Error): boolean => {
  const retryableErrors = [
    "ECONNRESET",
    "ENOTFOUND",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ApiError",
  ];

  return retryableErrors.some(
    (errorType) => error.name === errorType || error.message.includes(errorType)
  );
};

export const calculateRetryDelay = (
  attempt: number,
  baseDelay: number = 1000
): number => {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
};

export const shouldRetry = (
  attempt: number,
  maxRetries: number = 3
): boolean => {
  return attempt < maxRetries;
};
