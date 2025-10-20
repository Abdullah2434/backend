import { Request, Response } from "express";
import PerformanceTrackingService from "../services/performanceTracking.service";
import { AuthenticatedRequest } from "../types";

/**
 * Get performance statistics for a user
 */
export async function getPerformanceStats(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;
    const { platform, daysBack = 30 } = req.query;

    const stats = await PerformanceTrackingService.getUserPerformanceStats(
      userId!,
      platform as string,
      Number(daysBack)
    );

    return res.json({
      success: true,
      data: {
        stats,
        period: `${daysBack} days`,
        platform: platform || "all",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error getting performance stats:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get performance statistics",
    });
  }
}

/**
 * Get content recommendations based on performance data
 */
export async function getContentRecommendations(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;
    const { platform } = req.params;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: "Platform is required",
      });
    }

    const validPlatforms = [
      "youtube",
      "instagram",
      "tiktok",
      "facebook",
      "linkedin",
      "twitter",
    ];

    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        message: `Invalid platform. Must be one of: ${validPlatforms.join(
          ", "
        )}`,
      });
    }

    const recommendations =
      await PerformanceTrackingService.getContentRecommendations(
        userId!,
        platform
      );

    return res.json({
      success: true,
      data: {
        platform,
        recommendations,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error getting content recommendations:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get content recommendations",
    });
  }
}

/**
 * Update post engagement data
 */
export async function updatePostEngagement(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;
    const { platform, postId, engagementData } = req.body;

    if (!platform || !postId || !engagementData) {
      return res.status(400).json({
        success: false,
        message: "Platform, postId, and engagementData are required",
      });
    }

    const validPlatforms = [
      "youtube",
      "instagram",
      "tiktok",
      "facebook",
      "linkedin",
      "twitter",
    ];

    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        message: `Invalid platform. Must be one of: ${validPlatforms.join(
          ", "
        )}`,
      });
    }

    await PerformanceTrackingService.updatePostEngagement(
      userId!,
      platform,
      postId,
      engagementData
    );

    return res.json({
      success: true,
      message: "Post engagement updated successfully",
      data: {
        platform,
        postId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error updating post engagement:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update post engagement",
    });
  }
}

/**
 * Record performance metrics for a post
 */
export async function recordPerformanceMetrics(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;
    const {
      platform,
      postId,
      templateVariant,
      topicCategory,
      toneUsed,
      hookType,
      ctaType,
      engagementScore,
      reachScore,
      conversionScore,
    } = req.body;

    if (
      !platform ||
      !postId ||
      !templateVariant ||
      !topicCategory ||
      !toneUsed ||
      !hookType ||
      !ctaType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Platform, postId, templateVariant, topicCategory, toneUsed, hookType, and ctaType are required",
      });
    }

    await PerformanceTrackingService.recordPerformanceMetrics(
      userId!,
      platform,
      postId,
      {
        templateVariant,
        topicCategory,
        toneUsed,
        hookType,
        ctaType,
        platform,
        engagementScore,
        reachScore,
        conversionScore,
      }
    );

    return res.json({
      success: true,
      message: "Performance metrics recorded successfully",
      data: {
        platform,
        postId,
        recordedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error recording performance metrics:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to record performance metrics",
    });
  }
}

