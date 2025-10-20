import { Request, Response } from "express";
import BatchCaptionGenerationService, {
  UserContext,
} from "../services/batchCaptionGeneration.service";
import { AuthenticatedRequest } from "../types";

/**
 * Generate captions for multiple topics in batch
 */
export async function generateBatchCaptions(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;
    const { topics, userContext } = req.body;

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Topics array is required and must not be empty",
      });
    }

    // Validate topics structure
    for (const topic of topics) {
      if (!topic.topic || !topic.keyPoints) {
        return res.status(400).json({
          success: false,
          message: "Each topic must have 'topic' and 'keyPoints' fields",
        });
      }
    }

    const result = await BatchCaptionGenerationService.generateBatchCaptions({
      userId: userId!,
      topics,
      userContext,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error generating batch captions:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate batch captions",
    });
  }
}

/**
 * Generate content calendar with captions
 */
export async function generateContentCalendar(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;
    const { weeks, postsPerWeek, topics, userContext } = req.body;

    if (!weeks || !postsPerWeek) {
      return res.status(400).json({
        success: false,
        message: "Weeks and postsPerWeek are required",
      });
    }

    if (weeks < 1 || weeks > 12) {
      return res.status(400).json({
        success: false,
        message: "Weeks must be between 1 and 12",
      });
    }

    if (postsPerWeek < 1 || postsPerWeek > 7) {
      return res.status(400).json({
        success: false,
        message: "Posts per week must be between 1 and 7",
      });
    }

    const result = await BatchCaptionGenerationService.generateContentCalendar(
      userId!,
      userContext || {},
      {
        weeks,
        postsPerWeek,
        topics,
      }
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error generating content calendar:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate content calendar",
    });
  }
}

/**
 * Generate platform-specific captions
 */
export async function generatePlatformSpecificCaptions(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;
    const { topics, platforms, userContext } = req.body;

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Topics array is required and must not be empty",
      });
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Platforms array is required and must not be empty",
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

    for (const platform of platforms) {
      if (!validPlatforms.includes(platform)) {
        return res.status(400).json({
          success: false,
          message: `Invalid platform: ${platform}. Valid platforms are: ${validPlatforms.join(
            ", "
          )}`,
        });
      }
    }

    const result =
      await BatchCaptionGenerationService.generatePlatformSpecificCaptions(
        userId!,
        topics,
        platforms,
        userContext
      );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error generating platform-specific captions:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate platform-specific captions",
    });
  }
}

/**
 * Get batch generation status and statistics
 */
export async function getBatchGenerationStats(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;

    // Import the UserPostHistory model to get statistics
    const UserPostHistory = require("../models/UserPostHistory").default;

    const [totalPosts, platformStats, recentPosts] = await Promise.all([
      UserPostHistory.countDocuments({ userId }),
      UserPostHistory.aggregate([
        { $match: { userId } },
        { $group: { _id: "$platform", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      UserPostHistory.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("platform topicCategory toneUsed hookType ctaType createdAt")
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        totalPosts,
        platformStats,
        recentPosts,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error getting batch generation stats:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get batch generation statistics",
    });
  }
}

