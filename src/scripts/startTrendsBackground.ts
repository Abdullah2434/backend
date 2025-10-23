import dotenv from "dotenv";
import TrendsBackgroundService from "../services/trendsBackground.service";

// Load environment variables
dotenv.config();

/**
 * Start background trends generation service
 * This script should be run as a separate process or in a cron job
 */
async function startTrendsBackground() {
  try {
    console.log("🚀 Starting EdgeAI Trends Background Service");
    console.log("============================================\n");

    // Start the background service
    TrendsBackgroundService.start();

    // Get service status
    const status = TrendsBackgroundService.getStatus();
    console.log("📊 Service Status:", status);

    // Keep the process running
    console.log("\n✅ Background trends service is running...");
    console.log("Press Ctrl+C to stop");

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n🛑 Shutting down background trends service...");
      TrendsBackgroundService.stop();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("\n🛑 Shutting down background trends service...");
      TrendsBackgroundService.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Error starting background trends service:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  startTrendsBackground()
    .then(() => {
      console.log("✅ Background trends service started successfully");
    })
    .catch((error) => {
      console.error("❌ Background trends service failed:", error);
      process.exit(1);
    });
}

export default startTrendsBackground;
