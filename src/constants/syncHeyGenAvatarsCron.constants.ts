/**
 * Constants for sync HeyGen avatars cron job
 */

import dotenv from "dotenv";

dotenv.config();

// ==================== CRON JOB NAME ====================
export const CRON_JOB_NAME = "heygen-avatars-sync";

// ==================== API CONFIGURATION ====================
export const API_URL = `${process.env.HEYGEN_BASE_URL}/avatars`;
export const API_KEY = process.env.HEYGEN_API_KEY;

