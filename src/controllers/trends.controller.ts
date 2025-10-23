import { Request, Response } from "express";
import { generateRealEstateTrends } from "../services/trends.service";
import FastTrendsService from "../services/fastTrends.service";
import TrendsCacheService from "../services/trendsCache.service";
import OptimizedTrendsService from "../services/optimizedTrends.service";
import { AuthenticatedRequest } from "../types";

export const getRealEstateTrends = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    console.log("⚡ Getting ultra-fast real estate trends...");

    // Get user ID if authenticated, otherwise use null for public trends
    const userId = req.user?._id?.toString();
    const count = parseInt(req.query.count as string) || 10;
    const compressed = req.query.compressed === "true";

    let trends: any[];
    let cacheStatus: any = { cached: false, source: "direct" };

    if (compressed) {
      // Use ultra-optimized compressed response
      const result = await OptimizedTrendsService.getCompressedTrends(count);
      trends = result.trends;
      cacheStatus = { cached: result.cached, source: result.source };
    } else {
      // Use multi-layer caching system
      trends = await TrendsCacheService.getTrends(count);
      cacheStatus = await TrendsCacheService.getCacheStats();
    }

    res.status(200).json({
      success: true,
      message: "Real estate trends generated successfully",
      data: {
        topic: "real_estate",
        location: "America",
        trends: trends,
        count: trends.length,
        generated_by: "optimized-cache",
        user_authenticated: !!userId,
        cache_status: cacheStatus,
        compressed: compressed,
        performance: {
          response_time: Date.now(),
          cache_hit: cacheStatus.cached || cacheStatus.source === "cached",
        },
      },
    });
  } catch (error) {
    console.error("Error generating real estate trends:", error);

    // Fallback to fast trends service
    try {
      console.log("🔄 Falling back to fast trends service...");
      const trends = await FastTrendsService.getFastTrends(10);
      const cacheStatus = FastTrendsService.getCacheStatus();

      res.status(200).json({
        success: true,
        message: "Real estate trends generated successfully (fallback)",
        data: {
          topic: "real_estate",
          location: "America",
          trends: trends,
          count: trends.length,
          generated_by: "grok-fast-fallback",
          user_authenticated: !!req.user?._id,
          cache_status: cacheStatus,
          fallback: true,
        },
      });
    } catch (fallbackError) {
      console.error("Fallback also failed:", fallbackError);

      res.status(500).json({
        success: false,
        message: "Failed to generate real estate trends",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};
