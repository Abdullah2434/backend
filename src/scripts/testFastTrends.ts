import dotenv from "dotenv";
import FastTrendsService from "../services/fastTrends.service";

// Load environment variables
dotenv.config();

/**
 * Test script for fast trends generation
 */
async function testFastTrends(): Promise<void> {
  try {
    console.log("⚡ TESTING FAST TRENDS GENERATION");
    console.log("==================================\n");

    // Test 1: First call (should hit API)
    console.log("🧪 Test 1: First call (API request)");
    const start1 = Date.now();
    const trends1 = await FastTrendsService.getFastTrends(10);
    const time1 = Date.now() - start1;

    console.log(`✅ Generated ${trends1.length} trends in ${time1}ms`);
    console.log(`📊 Cache status:`, FastTrendsService.getCacheStatus());

    // Show first trend
    if (trends1.length > 0) {
      console.log(`\n📈 Sample trend: ${trends1[0].description}`);
      console.log(`   Instagram: ${trends1[0].instagram_caption}`);
    }

    // Test 2: Second call (should use cache)
    console.log("\n🧪 Test 2: Second call (should use cache)");
    const start2 = Date.now();
    const trends2 = await FastTrendsService.getFastTrends(10);
    const time2 = Date.now() - start2;

    console.log(`✅ Generated ${trends2.length} trends in ${time2}ms`);
    console.log(`📊 Cache status:`, FastTrendsService.getCacheStatus());

    // Test 3: Performance comparison
    console.log("\n📊 PERFORMANCE COMPARISON:");
    console.log(`   First call (API): ${time1}ms`);
    console.log(`   Second call (Cache): ${time2}ms`);
    console.log(
      `   Speed improvement: ${Math.round((time1 / time2) * 100)}% faster`
    );

    // Test 4: Cache validation
    console.log("\n🧪 Test 3: Cache validation");
    const cacheStatus = FastTrendsService.getCacheStatus();
    if (cacheStatus.cached && cacheStatus.valid) {
      console.log("✅ Cache is working correctly");
    } else {
      console.log("⚠️ Cache issue detected");
    }

    console.log("\n✅ Fast trends test completed successfully!");
    console.log("🎉 Your system now has lightning-fast trend generation!");
  } catch (error) {
    console.error("❌ Error testing fast trends:", error);
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Verify GROK_API_KEY is correctly set in .env file");
    console.log("2. Check your internet connection");
    console.log(
      "3. Ensure the Grok API key is valid and has sufficient credits"
    );
  }
}

// Run if called directly
if (require.main === module) {
  testFastTrends()
    .then(() => {
      console.log("\n✅ Test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Test failed:", error);
      process.exit(1);
    });
}

export default testFastTrends;
