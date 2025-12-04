/**
 * Constants for avatar status check cron job
 */

import dotenv from "dotenv";

dotenv.config();

// ==================== CRON CONFIGURATION ====================
export const CRON_JOB_NAME = "avatar-status-check";
export const CRON_SCHEDULE = "*/2 * * * *"; // Every 2 minutes

// ==================== AVATAR STATUSES ====================
export const AVATAR_STATUS_PENDING = "pending";
export const AVATAR_STATUS_READY = "ready";

// ==================== NOTIFICATION CONSTANTS ====================
export const NOTIFICATION_STATUS_SUCCESS = "success";
export const NOTIFICATION_TYPE_READY = "ready";

// ==================== API CONFIGURATION ====================
export const API_KEY = process.env.HEYGEN_API_KEY;
export const STATUS_URL = process.env.HEYGEN_BASE_URL
  ? `${process.env.HEYGEN_BASE_URL}/photo_avatar/train/status`
  : undefined;

