import dotenv from "dotenv";
dotenv.config();

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

