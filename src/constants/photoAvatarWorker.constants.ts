/**
 * Constants for photo avatar worker
 */

import dotenv from "dotenv";

dotenv.config();

// ==================== API CONFIGURATION ====================
export const API_KEY = process.env.HEYGEN_API_KEY;
export const UPLOAD_URL = "https://upload.heygen.com/v1/asset";
export const AVATAR_GROUP_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/avatar_group/create`;
export const TRAIN_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/train`;

// ==================== REDIS CONNECTION ====================
export const redisConnection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// ==================== TIMING CONSTANTS ====================
export const TRAINING_DELAY_MS = 20000; // 20 seconds delay before training

// ==================== ERROR CODES ====================
export const ERROR_CODES = {
  UPLOAD_FAILED: "upload_failed",
  AUTH_FAILED: "auth_failed",
  FILE_TOO_LARGE: "file_too_large",
  UNSUPPORTED_FORMAT: "unsupported_format",
  SERVER_ERROR: "server_error",
  NETWORK_ERROR: "network_error",
  TRAINING_FAILED: "training_failed",
  INVALID_IMAGE: "invalid_image",
  INVALID_PARAMETERS: "invalid_parameters",
  RATE_LIMITED: "rate_limited",
  INSUFFICIENT_CREDITS: "insufficient_credits",
  IMAGE_TOO_SMALL: "image_too_small",
  IMAGE_TOO_LARGE: "image_too_large",
  ACCESS_DENIED: "access_denied",
  PROCESSING_ERROR: "processing_error",
  FILE_NOT_FOUND: "file_not_found",
  PERMISSION_ERROR: "permission_error",
  VALIDATION_ERROR: "validation_error",
  UNKNOWN_ERROR: "unknown_error",
} as const;

