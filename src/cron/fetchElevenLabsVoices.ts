import dotenv from "dotenv";
dotenv.config();

import cron from "node-cron";
import { fetchAndSyncElevenLabsVoices } from "../services/elevenLabsVoice.service";

/**
 * Run ElevenLabs voices sync once immediately
 */
export async function startElevenLabsVoicesSync() {
  const startTime = Date.now();


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

export function startElevenLabsVoicesSyncCron() {
  // Run at 11:03 AM and 11:03 PM (every 12 hours): 3 11,23 * * *
  cron.schedule("3 11,23 * * *", async () => {
    const startTime = Date.now();
 
    try {
      await fetchAndSyncElevenLabsVoices();
      const duration = Date.now() - startTime;
  
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ ElevenLabs voices sync cron job failed after ${duration}ms:`,
        error.message
      );
    }
  });

}

// For manual run/testing
if (require.main === module) {
  (async () => {
    try {
      await fetchAndSyncElevenLabsVoices();
  
      process.exit(0);
    } catch (error: any) {
  
      process.exit(1);
    }
  })();
}

