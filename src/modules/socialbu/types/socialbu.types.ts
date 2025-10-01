// ==================== SOCIALBU MODULE TYPES ====================

import { Request, Response } from "express";
import mongoose from "mongoose";

// ==================== REQUEST TYPES ====================

export interface SocialBuRequest extends Request {
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    [key: string]: any;
  };
}

export interface SocialBuResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// ==================== AUTHENTICATION TYPES ====================

export interface SocialBuAuthData {
  authToken: string;
  id: string;
  name: string;
  email: string;
  verified: boolean;
}

export interface SocialBuLoginRequest {
  email?: string;
  password?: string;
}

export interface SocialBuLoginResponse {
  success: boolean;
  message: string;
  data?: {
    authToken: string;
    user: {
      id: string;
      name: string;
      email: string;
      verified: boolean;
    };
  };
  error?: string;
}

export interface SocialBuTokenData {
  _id: string;
  authToken: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    verified: boolean;
  };
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== ACCOUNT TYPES ====================

export interface SocialBuAccount {
  _id: string;
  userId: string;
  accountId: string;
  accountName: string;
  platform: string;
  status: "active" | "inactive" | "pending" | "suspended";
  connectedAt: Date;
  lastSyncAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialBuAccountRequest {
  accountId: string;
  accountName: string;
  platform: string;
  metadata?: Record<string, any>;
}

export interface SocialBuAccountResponse {
  success: boolean;
  message: string;
  data?: SocialBuAccount;
  error?: string;
}

export interface SocialBuAccountsListResponse {
  success: boolean;
  message: string;
  data?: {
    accounts: SocialBuAccount[];
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
}

// ==================== MEDIA TYPES ====================

export interface SocialBuMedia {
  _id: string;
  userId: string;
  name: string;
  mime_type: string;
  socialbuResponse: {
    name: string;
    mime_type: string;
    signed_url: string;
    key: string;
    secure_key: string;
    url: string;
  };
  uploadScript: {
    videoUrl: string;
    executed: boolean;
    status: "pending" | "executing" | "completed" | "failed";
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    response?: {
      statusCode: number;
      headers: any;
      success: boolean;
      finalVideoUrl?: string;
      errorMessage?: string;
    };
  };
  status:
    | "pending"
    | "api_completed"
    | "script_executing"
    | "script_completed"
    | "failed";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialBuMediaRequest {
  name: string;
  mime_type: string;
  videoUrl: string;
}

export interface SocialBuMediaResponse {
  success: boolean;
  message: string;
  data?: SocialBuMedia;
  error?: string;
}

export interface SocialBuMediaListResponse {
  success: boolean;
  message: string;
  data?: {
    media: SocialBuMedia[];
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
}

// ==================== API RESPONSE TYPES ====================

export interface SocialBuApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface SocialBuApiError {
  success: false;
  error: string;
  message?: string;
  statusCode?: number;
}

// ==================== WEBHOOK TYPES ====================

export interface SocialBuWebhookData {
  account_id: string;
  user_id: string;
  platform: string;
  account_name: string;
  event_type: string;
  timestamp: string;
  data?: any;
}

export interface SocialBuWebhookResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// ==================== CONFIGURATION TYPES ====================

export interface SocialBuConfig {
  apiUrl: string;
  apiKey: string;
  webhookSecret: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableLogging: boolean;
  enableWebhooks: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
}

// ==================== ERROR TYPES ====================

export class SocialBuError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "SOCIALBU_ERROR",
    details?: any
  ) {
    super(message);
    this.name = "SocialBuError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class AuthenticationError extends SocialBuError {
  constructor(message: string = "Authentication failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class ValidationError extends SocialBuError {
  field?: string;

  constructor(
    message: string,
    field?: string,
    statusCode: number = 400,
    code: string = "VALIDATION_ERROR"
  ) {
    super(message, statusCode, code);
    this.field = field;
  }
}

export class ApiError extends SocialBuError {
  constructor(
    message: string = "SocialBu API error",
    statusCode: number = 500,
    details?: any
  ) {
    super(message, statusCode, "API_ERROR", details);
  }
}

export class MediaError extends SocialBuError {
  constructor(
    message: string = "Media processing error",
    statusCode: number = 500,
    details?: any
  ) {
    super(message, statusCode, "MEDIA_ERROR", details);
  }
}

export class AccountError extends SocialBuError {
  constructor(
    message: string = "Account management error",
    statusCode: number = 500,
    details?: any
  ) {
    super(message, statusCode, "ACCOUNT_ERROR", details);
  }
}

// ==================== UTILITY TYPES ====================

export interface SocialBuStats {
  totalAccounts: number;
  activeAccounts: number;
  totalMedia: number;
  processedMedia: number;
  failedMedia: number;
  lastSyncAt?: Date;
}

export interface SocialBuAnalytics {
  accountsByPlatform: Array<{
    platform: string;
    count: number;
    active: number;
  }>;
  mediaByStatus: Array<{
    status: string;
    count: number;
  }>;
  processingTime: {
    average: number;
    min: number;
    max: number;
  };
  errorRate: number;
}

export interface SocialBuHealthCheck {
  status: "healthy" | "unhealthy";
  services: {
    api: "available" | "unavailable";
    database: "available" | "unavailable";
    webhooks: "available" | "unavailable";
  };
  timestamp: string;
  uptime: number;
}

// ==================== VALIDATION TYPES ====================

export interface SocialBuValidationRules {
  authToken: {
    required: boolean;
    minLength: number;
    pattern: RegExp;
  };
  accountId: {
    required: boolean;
    pattern: RegExp;
  };
  accountName: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  platform: {
    required: boolean;
    allowedValues: string[];
  };
  mediaName: {
    required: boolean;
    minLength: number;
    maxLength: number;
    pattern: RegExp;
  };
  mimeType: {
    required: boolean;
    allowedValues: string[];
  };
}

// ==================== PAGINATION TYPES ====================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filter?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ==================== SEARCH TYPES ====================

export interface SearchParams {
  query: string;
  fields: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface SearchResponse<T> {
  results: T[];
  total: number;
  page: number;
  limit: number;
  query: string;
  took: number;
}

// ==================== EXPORT ALL TYPES ====================
