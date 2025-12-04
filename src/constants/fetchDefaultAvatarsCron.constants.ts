/**
 * Constants for fetch default avatars cron job
 */

import dotenv from "dotenv";

dotenv.config();

// ==================== CRON CONFIGURATION ====================
export const CRON_JOB_NAME = "fetch-default-avatars";

// ==================== API CONFIGURATION ====================
export const API_KEY = process.env.HEYGEN_API_KEY;
export const AVATARS_API_URL = process.env.HEYGEN_BASE_URL
  ? `${process.env.HEYGEN_BASE_URL}/avatars`
  : undefined;
export const VOICES_API_URL = process.env.HEYGEN_BASE_URL
  ? `${process.env.HEYGEN_BASE_URL}/voices`
  : undefined;

