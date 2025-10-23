import TrendsCacheService from "./trendsCache.service";
import OptimizedTrendsService from "./optimizedTrends.service";

/**
 * Background trend generation service
 * Pre-generates trends to ensure instant API responses
 */
export class TrendsBackgroundService {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly PRE_GENERATION_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

  /**
   * Start background trend generation
   */
  static start(): void {
    if (this.isRunning) {
      console.log("🔄 Background trends service already running");
      return;
    }

    console.log("🚀 Starting background trends generation service...");
    this.isRunning = true;

    // Initial warm-up
    this.warmUpCache();

    // Schedule regular pre-generation
    this.intervalId = setInterval(() => {
      this.preGenerateTrends();
    }, this.PRE_GENERATION_INTERVAL);

    console.log("✅ Background trends service started");
  }

  /**
   * Stop background trend generation
   */
  static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("🛑 Background trends service stopped");
  }

  /**
   * Warm up cache on startup
   */
  private static async warmUpCache(): Promise<void> {
    try {
      console.log("🔥 Warming up trends cache...");
      await TrendsCacheService.warmUpCache();
      console.log("✅ Cache warmed up successfully");
    } catch (error) {
      console.error("❌ Error warming up cache:", error);
    }
  }

  /**
   * Pre-generate trends for the day
   */
  private static async preGenerateTrends(): Promise<void> {
    try {
      console.log("🔄 Pre-generating trends in background...");
      await TrendsCacheService.preGenerateTrends();
      console.log("✅ Background trend generation completed");
    } catch (error) {
      console.error("❌ Error in background trend generation:", error);
    }
  }

  /**
   * Force immediate trend generation
   */
  static async forceGeneration(): Promise<void> {
    console.log("⚡ Force generating trends...");
    await this.preGenerateTrends();
  }

  /**
   * Get service status
   */
  static getStatus(): {
    running: boolean;
    nextGeneration: Date | null;
    interval: number;
  } {
    return {
      running: this.isRunning,
      nextGeneration: this.intervalId
        ? new Date(Date.now() + this.PRE_GENERATION_INTERVAL)
        : null,
      interval: this.PRE_GENERATION_INTERVAL,
    };
  }

  /**
   * Generate trends for specific date
   */
  static async generateForDate(date: string): Promise<void> {
    try {
      console.log(`📅 Generating trends for ${date}...`);

      // Generate trends using optimized service
      const trends = await OptimizedTrendsService.getOptimizedTrends(10);

      // Cache the trends
      await TrendsCacheService.cacheTrends(date, trends);

      console.log(`✅ Trends generated and cached for ${date}`);
    } catch (error) {
      console.error(`❌ Error generating trends for ${date}:`, error);
    }
  }

  /**
   * Generate trends for multiple dates
   */
  static async generateForDateRange(
    startDate: string,
    endDate: string
  ): Promise<void> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log(
      `📅 Generating trends for date range: ${startDate} to ${endDate}`
    );

    for (
      let date = new Date(start);
      date <= end;
      date.setDate(date.getDate() + 1)
    ) {
      const dateStr = date.toISOString().split("T")[0];
      await this.generateForDate(dateStr);

      // Small delay to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("✅ Date range trend generation completed");
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<any> {
    return await TrendsCacheService.getCacheStats();
  }

  /**
   * Clear all caches
   */
  static async clearAllCaches(): Promise<void> {
    await TrendsCacheService.clearAllCaches();
  }
}

export default TrendsBackgroundService;
