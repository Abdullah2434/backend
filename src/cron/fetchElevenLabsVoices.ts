import dotenv from "dotenv";
dotenv.config();

import cron from "node-cron";
import { fetchAndSyncElevenLabsVoices } from "../services/elevenLabsVoice.service";

/**
 * Run ElevenLabs voices sync once immediately
 */
export async function startElevenLabsVoicesSync() {
  const startTime = Date.now();
  console.log("🔄 Starting ElevenLabs voices sync job...");

  try {
    await fetchAndSyncElevenLabsVoices();
    const duration = Date.now() - startTime;
    console.log(
      `✅ ElevenLabs voices sync job completed in ${duration}ms`
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `❌ ElevenLabs voices sync job failed after ${duration}ms:`,
      error.message
    );
  }
}

/**
 * Start cron job to sync ElevenLabs voices twice daily (every 12 hours)
 * - Runs at 11:03 AM and 11:03 PM
 * - Fetches voices from ElevenLabs API
 * - Adds new voices to database
 * - Updates existing voices
 * - Removes voices that no longer exist in API (except cloned voices)
 */
export function startElevenLabsVoicesSyncCron() {
  // Run at 11:03 AM and 11:03 PM (every 12 hours): 3 11,23 * * *
  cron.schedule("3 11,23 * * *", async () => {
    const startTime = Date.now();
    console.log(
      `⏰ ElevenLabs voices sync cron job started at ${new Date().toISOString()}`
    );

    try {
      await fetchAndSyncElevenLabsVoices();
      const duration = Date.now() - startTime;
      console.log(
        `✅ ElevenLabs voices sync cron job completed in ${duration}ms`
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ ElevenLabs voices sync cron job failed after ${duration}ms:`,
        error.message
      );
    }
  });

  console.log(
    "⏰ ElevenLabs voices sync cron job started - running at 11:03 AM and 11:03 PM (every 12 hours)"
  );
}

// For manual run/testing
if (require.main === module) {
  (async () => {
    try {
      await fetchAndSyncElevenLabsVoices();
      console.log("✅ Manual sync completed successfully");
      process.exit(0);
    } catch (error: any) {
      console.error("❌ Manual sync failed:", error.message);
      process.exit(1);
    }
  })();
}

