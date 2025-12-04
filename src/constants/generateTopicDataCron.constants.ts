/**
 * Constants for generate topic data cron job
 */

import dotenv from "dotenv";

dotenv.config();

// ==================== CRON CONFIGURATION ====================
export const CRON_JOB_NAME = "generate-topic-data";

// ==================== OPENAI API CONFIGURATION ====================
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

