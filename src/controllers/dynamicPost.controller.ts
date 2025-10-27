import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { DynamicPostGenerationService } from "../services/dynamicPostGeneration.service";
import UserVideoSettings from "../models/UserVideoSettings";
import UserPostHistory from "../models/UserPostHistory";
import ContentTemplate from "../models/ContentTemplate";

export const generateDynamicPosts = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { topic, keyPoints, platforms, userContext } = req.body;
      const userId = req.user?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      if (!topic || !keyPoints) {
        return res.status(400).json({
          success: false,
          message: "Topic and keyPoints are required",
        });
      }

      // Get agent information from UserVideoSettings
      let agentInfo = {
        name: "Real Estate Professional",
        position: "Real Estate Agent",
        companyName: "Real Estate Company",
        city: "Your City",
        socialHandles: "@realestate",
      };

      try {
        const userSettings = await UserVideoSettings.findOne({ userId });
        if (userSettings) {
          agentInfo = {
            name: userSettings.name,
            position: userSettings.position,
            companyName: userSettings.companyName,
            city: userSettings.city,
            socialHandles: userSettings.socialHandles,
          };
          console.log(
            `📋 Retrieved agent info from UserVideoSettings: ${agentInfo.name} - ${agentInfo.companyName}`
          );
        } else {
          console.log(
            `⚠️ No UserVideoSettings found for user ${userId}, using default agent info`
          );
        }
      } catch (error) {
        console.warn(
          `⚠️ Error retrieving UserVideoSettings for user ${userId}:`,
          error
        );
      }

      // Merge with provided userContext (form data takes priority)
      const finalUserContext = { ...agentInfo, ...userContext };

      console.log(`🎯 Generating dynamic posts for user ${userId}`);
      console.log(`📝 Topic: ${topic}`);
      console.log(`🎯 Platforms: ${platforms.join(", ")}`);

      // Generate dynamic posts
      const generatedPosts =
        await DynamicPostGenerationService.generateDynamicPosts(
          topic,
          keyPoints,
          finalUserContext,
          userId,
          platforms
        );

      console.log(`✅ Generated ${generatedPosts.length} dynamic posts`);

      res.status(200).json({
        success: true,
        message: "Dynamic posts generated successfully",
        data: {
          posts: generatedPosts,
          totalPosts: generatedPosts.length,
          platforms: platforms,
          topic: topic,
          userContext: finalUserContext,
        },
      });
    } catch (error) {
      console.error("Error generating dynamic posts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate dynamic posts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export const getPostHistory = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?._id;
      const { platform, limit = 10 } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const query: any = { userId };
      if (platform) {
        query.platform = platform;
      }

      const posts = await UserPostHistory.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .lean();

      res.status(200).json({
        success: true,
        message: "Post history retrieved successfully",
        data: {
          posts,
          totalPosts: posts.length,
          platform: platform || "all",
        },
      });
    } catch (error) {
      console.error("Error retrieving post history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve post history",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export const getPostAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?._id;
      const { platform, days = 30 } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const query: any = { userId };
      if (platform) {
        query.platform = platform;
      }

      // Get posts from last N days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));
      query.createdAt = { $gte: startDate };

      const posts = await UserPostHistory.find(query).lean();

      // Analyze patterns
      const analytics: any = {
        totalPosts: posts.length,
        platforms: {},
        templateVariants: {},
        hookTypes: {},
        tones: {},
        ctaTypes: {},
        topicTypes: {},
        averageCharacterCount: 0,
        averageHashtagCount: 0,
        averageEmojiCount: 0,
      };

      // Calculate analytics
      posts.forEach((post: any) => {
        // Platform distribution
        analytics.platforms[post.platform] =
          (analytics.platforms[post.platform] || 0) + 1;

        // Template variant distribution
        analytics.templateVariants[post.templateVariant] =
          (analytics.templateVariants[post.templateVariant] || 0) + 1;

        // Hook type distribution
        analytics.hookTypes[post.hookType] =
          (analytics.hookTypes[post.hookType] || 0) + 1;

        // Tone distribution
        analytics.tones[post.tone] = (analytics.tones[post.tone] || 0) + 1;

        // CTA type distribution
        analytics.ctaTypes[post.ctaType] =
          (analytics.ctaTypes[post.ctaType] || 0) + 1;

        // Topic type distribution
        analytics.topicTypes[post.topicType] =
          (analytics.topicTypes[post.topicType] || 0) + 1;

        // Averages
        analytics.averageCharacterCount += post.metadata?.characterCount || 0;
        analytics.averageHashtagCount += post.metadata?.hashtagCount || 0;
        analytics.averageEmojiCount += post.metadata?.emojiCount || 0;
      });

      // Calculate averages
      if (posts.length > 0) {
        analytics.averageCharacterCount = Math.round(
          analytics.averageCharacterCount / posts.length
        );
        analytics.averageHashtagCount = Math.round(
          analytics.averageHashtagCount / posts.length
        );
        analytics.averageEmojiCount = Math.round(
          analytics.averageEmojiCount / posts.length
        );
      }

      res.status(200).json({
        success: true,
        message: "Post analytics retrieved successfully",
        data: {
          analytics,
          period: `${days} days`,
          platform: platform || "all",
        },
      });
    } catch (error) {
      console.error("Error retrieving post analytics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve post analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export const getTemplates = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { platform, variant } = req.query;

      const query: any = { isActive: true };
      if (platform) {
        query.platform = platform;
      }
      if (variant) {
        query.variant = Number(variant);
      }

      const templates = await ContentTemplate.find(query).lean();

      res.status(200).json({
        success: true,
        message: "Templates retrieved successfully",
        data: {
          templates,
          totalTemplates: templates.length,
          platform: platform || "all",
        },
      });
    } catch (error) {
      console.error("Error retrieving templates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve templates",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export const testDynamicPosts = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { topic, keyPoints, platforms, userContext } = req.body;

      if (!topic || !keyPoints) {
        return res.status(400).json({
          success: false,
          message: "Topic and keyPoints are required",
        });
      }

      const testUserId = "507f1f77bcf86cd799439011"; // Test user ID
      const testUserContext = {
        name: "Sarah Johnson",
        position: "Real Estate Agent",
        companyName: "Austin Realty Group",
        city: "Austin",
        socialHandles: "@sarahjohnson_realty",
        ...userContext,
      };

      console.log(`🧪 Testing dynamic post generation`);
      console.log(`📝 Topic: ${topic}`);
      console.log(
        `🎯 Platforms: ${
          Array.isArray(platforms) ? platforms.join(", ") : platforms || "all"
        }`
      );

      // Ensure platforms is an array
      const platformsArray = Array.isArray(platforms)
        ? platforms
        : platforms
        ? [platforms]
        : ["instagram", "facebook", "linkedin"];

      // Generate dynamic posts
      const generatedPosts =
        await DynamicPostGenerationService.generateDynamicPosts(
          topic,
          keyPoints,
          testUserContext,
          testUserId,
          platformsArray
        );

      console.log(`✅ Generated ${generatedPosts.length} test posts`);

      res.status(200).json({
        success: true,
        message: "Test dynamic posts generated successfully",
        data: {
          posts: generatedPosts,
          totalPosts: generatedPosts.length,
          platforms: platformsArray,
          topic: topic,
          userContext: testUserContext,
        },
      });
    } catch (error) {
      console.error("Error generating test dynamic posts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate test dynamic posts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export const enhanceScheduleWithDynamicPosts = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const { scheduleId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // This would integrate with VideoScheduleService
      // For now, return a placeholder response
      res.status(200).json({
        success: true,
        message: "Schedule enhancement endpoint ready",
        data: {
          scheduleId,
          userId,
          note: "This endpoint will enhance existing schedules with dynamic posts",
        },
      });
    } catch (error) {
      console.error("Error enhancing schedule:", error);
      res.status(500).json({
        success: false,
        message: "Failed to enhance schedule",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);
