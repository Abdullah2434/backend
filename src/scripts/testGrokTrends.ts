import dotenv from "dotenv";
import { generateRealEstateTrends } from "../services/trends.service";

// Load environment variables
dotenv.config();

/**
 * Test script to verify Grok API integration for trend generation
 */
async function testGrokTrends(): Promise<void> {
  try {
    console.log("🤖 TESTING GROK TRENDS GENERATION");
    console.log("==================================\n");

    // Check if Grok API key is configured
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
      console.log("❌ GROK_API_KEY not found in environment variables");
      console.log("Please add GROK_API_KEY to your .env file");
      return;
    }

    console.log("✅ Grok API key found");
    console.log(`🔑 Key: ${grokApiKey.substring(0, 10)}...`);

    // Test trend generation with Grok
    console.log("\n🧪 Testing Grok Trends Generation...");
    console.log("Generating 5 current trending real estate topics...\n");

    const trends = await generateRealEstateTrends(5, 0, 0, "test-user-123");

    console.log("🎯 GENERATED TRENDS:");
    console.log("===================");
    console.log(
      `✅ Generated ${trends.length} trending topics using Grok AI\n`
    );

    trends.forEach((trend, index) => {
      console.log(`📈 TREND ${index + 1}:`);
      console.log(`   Description: ${trend.description}`);
      console.log(`   Key Points: ${trend.keypoints}`);
      console.log(
        `   Instagram: ${trend.instagram_caption.substring(0, 80)}...`
      );
      console.log(`   LinkedIn: ${trend.linkedin_caption.substring(0, 80)}...`);
      console.log(`   TikTok: ${trend.tiktok_caption.substring(0, 80)}...`);
      console.log("");
    });

    console.log("✅ Grok trends generation test completed successfully!");
    console.log(
      "🎉 Your system is generating current, trending real estate topics using Grok AI!"
    );
  } catch (error) {
    console.error("❌ Error testing Grok trends:", error);
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Verify GROK_API_KEY is correctly set in .env file");
    console.log("2. Check your internet connection");
    console.log(
      "3. Ensure the Grok API key is valid and has sufficient credits"
    );
    console.log("4. Check if the Grok API endpoint is accessible");
  }
}

// Run if called directly
if (require.main === module) {
  testGrokTrends()
    .then(() => {
      console.log("\n✅ Test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Test failed:", error);
      process.exit(1);
    });
}

export default testGrokTrends;
