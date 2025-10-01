import { Request, Response } from "express";

// ==================== REQUEST/RESPONSE TYPES ====================

export interface TrendsRequest extends Request {
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    [key: string]: any;
  };
}

export interface TrendsResponse extends Response {}

// ==================== TREND DATA TYPES ====================

export interface TrendData {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  timestamp: string;
  source: string;
  confidence: number;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface TrendsResult {
  success: boolean;
  message: string;
  data?: {
    topic: string;
    location: string;
    trends: TrendData[];
    count: number;
    generatedAt: string;
    metadata?: Record<string, any>;
  };
  error?: string;
}

// ==================== TREND GENERATION TYPES ====================

export interface TrendGenerationRequest {
  topic: string;
  location?: string;
  category?: string;
  limit?: number;
  filters?: Record<string, any>;
}

export interface TrendGenerationResult {
  success: boolean;
  trends: TrendData[];
  count: number;
  metadata?: Record<string, any>;
}

// ==================== CONFIGURATION TYPES ====================

export interface TrendsConfig {
  apiKey: string;
  apiUrl: string;
  defaultLocation: string;
  defaultLimit: number;
  enableCaching: boolean;
  cacheExpiry: number;
  rateLimitWindow: number;
  rateLimitMax: number;
}

// ==================== ERROR TYPES ====================

export class TrendsError extends Error {
  public readonly statusCode: number;
  public readonly field?: string;

  constructor(message: string, statusCode: number = 500, field?: string) {
    super(message);
    this.name = "TrendsError";
    this.statusCode = statusCode;
    this.field = field;
  }
}

export class ValidationError extends TrendsError {
  constructor(message: string, field?: string) {
    super(message, 400, field);
    this.name = "ValidationError";
  }
}

export class ApiError extends TrendsError {
  constructor(message: string) {
    super(message, 500);
    this.name = "ApiError";
  }
}

export class RateLimitError extends TrendsError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, 429);
    this.name = "RateLimitError";
  }
}

// ==================== MIDDLEWARE TYPES ====================

export interface TrendsMiddlewareOptions {
  rateLimitWindow?: number;
  rateLimitMax?: number;
  enableLogging?: boolean;
  enableValidation?: boolean;
}

// ==================== SERVICE TYPES ====================

export interface TrendsServiceInterface {
  generateRealEstateTrends(): Promise<TrendGenerationResult>;
  generateTrends(
    request: TrendGenerationRequest
  ): Promise<TrendGenerationResult>;
  getTrendCategories(): string[];
  validateTrendRequest(request: TrendGenerationRequest): boolean;
  healthCheck(): Promise<{ status: string; timestamp: string }>;
}

// ==================== UTILITY TYPES ====================

export interface TrendsStats {
  totalTrends: number;
  categories: Record<string, number>;
  locations: Record<string, number>;
  lastUpdated: string;
}

export interface TrendsCache {
  key: string;
  data: TrendData[];
  expiresAt: Date;
  createdAt: Date;
}

// ==================== EXPORT ALL TYPES ====================

// All types are already exported above
