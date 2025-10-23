import mongoose, { Document, Schema } from "mongoose";
import FastTrendsService from "./fastTrends.service";

// Redis-like in-memory cache with persistence
interface CachedTrends extends Document {
  date: string; // YYYY-MM-DD format
  trends: any[];
  generatedAt: Date;
  expiresAt: Date;
  source: "grok" | "fallback";
  version: number;
}

const CachedTrendsSchema = new Schema<CachedTrends>(
  {
    date: { type: String, required: true, unique: true, index: true },
    trends: { type: [Schema.Types.Mixed], required: true },
    generatedAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true },
    source: { type: String, enum: ["grok", "fallback"], default: "grok" },
    version: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  }
);

// TTL index for automatic cleanup
CachedTrendsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CachedTrendsModel = mongoose.model<CachedTrends>(
  "CachedTrends",
  CachedTrendsSchema
);

/**
 * High-performance trends caching service
 */
export class TrendsCacheService {
  private static memoryCache = new Map<string, any>();
  private static readonly MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly DB_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get trends with multi-layer caching
   */
  static async getTrends(count: number = 10): Promise<any[]> {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const cacheKey = `trends_${today}_${count}`;

    // 1. Check memory cache first (fastest)
    const memoryResult = this.getFromMemoryCache(cacheKey);
    if (memoryResult) {
      console.log("⚡ Using memory cache (instant response)");
      return memoryResult;
    }

    // 2. Check database cache
    const dbResult = await this.getFromDatabaseCache(today);
    if (dbResult) {
      console.log("💾 Using database cache (fast response)");
      this.setMemoryCache(cacheKey, dbResult);
      return dbResult.slice(0, count);
    }

    // 3. Generate fresh trends
    console.log("🚀 Generating fresh trends...");
    const freshTrends = await this.generateFreshTrends(count);

    // 4. Cache the results
    await this.cacheTrends(today, freshTrends);
    this.setMemoryCache(cacheKey, freshTrends);

    return freshTrends;
  }

  /**
   * Get from memory cache
   */
  private static getFromMemoryCache(key: string): any[] | null {
    const cached = this.memoryCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.MEMORY_CACHE_TTL) {
      return cached.data;
    }
    this.memoryCache.delete(key);
    return null;
  }

  /**
   * Set memory cache
   */
  private static setMemoryCache(key: string, data: any[]): void {
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get from database cache
   */
  private static async getFromDatabaseCache(
    date: string
  ): Promise<any[] | null> {
    try {
      const cached = await CachedTrendsModel.findOne({
        date,
        expiresAt: { $gt: new Date() },
      }).lean();

      if (cached) {
        console.log(`📊 Found cached trends for ${date} (${cached.source})`);
        return cached.trends;
      }
    } catch (error) {
      console.error("Error reading from database cache:", error);
    }
    return null;
  }

  /**
   * Generate fresh trends with optimized approach
   */
  private static async generateFreshTrends(count: number): Promise<any[]> {
    try {
      // Try fast trends service first
      const trends = await FastTrendsService.getFastTrends(count);
      return trends;
    } catch (error) {
      console.error("Error generating fresh trends:", error);
      // Return fallback trends
      return FastTrendsService.getFallbackTrends(count);
    }
  }

  /**
   * Cache trends in database
   */
  private static async cacheTrends(date: string, trends: any[]): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + this.DB_CACHE_TTL);

      await CachedTrendsModel.findOneAndUpdate(
        { date },
        {
          date,
          trends,
          generatedAt: new Date(),
          expiresAt,
          source: "grok",
          version: 1,
        },
        { upsert: true, new: true }
      );

      console.log(`💾 Cached ${trends.length} trends for ${date}`);
    } catch (error) {
      console.error("Error caching trends:", error);
    }
  }

  /**
   * Pre-generate trends for today (background task)
   */
  static async preGenerateTrends(): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    // Check if we already have today's trends
    const existing = await this.getFromDatabaseCache(today);
    if (existing) {
      console.log("📊 Trends already cached for today");
      return;
    }

    console.log("🔄 Pre-generating trends for today...");
    try {
      const trends = await this.generateFreshTrends(10);
      await this.cacheTrends(today, trends);
      console.log("✅ Pre-generated trends for today");
    } catch (error) {
      console.error("Error pre-generating trends:", error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    memoryCache: { size: number; keys: string[] };
    databaseCache: { count: number; dates: string[] };
  }> {
    const memoryKeys = Array.from(this.memoryCache.keys());
    const dbCache = await CachedTrendsModel.find({}, "date").lean();

    return {
      memoryCache: {
        size: this.memoryCache.size,
        keys: memoryKeys,
      },
      databaseCache: {
        count: dbCache.length,
        dates: dbCache.map((c) => c.date),
      },
    };
  }

  /**
   * Clear all caches
   */
  static async clearAllCaches(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear database cache
    await CachedTrendsModel.deleteMany({});

    console.log("🗑️ All caches cleared");
  }

  /**
   * Warm up cache (for startup)
   */
  static async warmUpCache(): Promise<void> {
    console.log("🔥 Warming up trends cache...");
    await this.preGenerateTrends();
    console.log("✅ Cache warmed up");
  }
}

export default TrendsCacheService;
