/**
 * Constants for fetch ElevenLabs voices cron job
 */

import dotenv from "dotenv";
import { VALID_CRON_SCHEDULES } from "../validations/fetchElevenLabsVoices.validations";

dotenv.config();

// ==================== CRON CONFIGURATION ====================
export const CRON_JOB_NAME = "elevenlabs-voices-sync";
export const CRON_SCHEDULE = VALID_CRON_SCHEDULES.TWICE_DAILY; // 11:03 AM and 11:03 PM

