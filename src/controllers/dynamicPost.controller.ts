import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { DynamicPostGenerationService } from "../services/content";
import UserVideoSettings from "../models/UserVideoSettings";
import UserPostHistory from "../models/UserPostHistory";
import ContentTemplate from "../models/ContentTemplate";
import { ResponseHelper } from "../utils/responseHelper";
import {
  generateDynamicPostsSchema,
  testDynamicPostsSchema,
  getPostHistoryQuerySchema,
  getPostAnalyticsQuerySchema,
  getTemplatesQuerySchema,
  scheduleIdParamSchema,
} from "../validations/dynamicPost.validations";
import { ZodError } from "zod";
import {
  UserContext,
  PostAnalytics,
  DefaultUserContext,
} from "../types/dynamicPost.types";
import { ValidationError } from "../types";

// ==================== HELPER FUNCTIONS ====================

/**
 * Get user ID from authenticated request
 * Throws error if user is not authenticated
 */
function getUserId(req: Request): string {
  const userId = (req as any).user?._id;
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId.toString();
}

/**
 * Format validation errors from Zod
 */
function formatValidationErrors(error: ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

/**
 * Get user context from UserVideoSettings
 */
async function getUserContext(userId: string): Promise<UserContext> {
  const defaults: DefaultUserContext = {
    name: "Real Estate Professional",
    position: "Real Estate Agent",
    companyName: "Real Estate Company",
    city: "Your City",
    socialHandles: "@realestate",
  };

  try {
    const userSettings = await UserVideoSettings.findOne({ userId });
    if (!userSettings) {
      return defaults;
    }

    return {
      name: userSettings.name || defaults.name,
      position: userSettings.position || defaults.position,
      companyName: userSettings.companyName || defaults.companyName,
      city: userSettings.city || defaults.city,
      socialHandles: userSettings.socialHandles || defaults.socialHandles,
      language: userSettings.language,
    };
  } catch (error) {
    console.warn(
      `⚠️ Error retrieving UserVideoSettings for user ${userId}:`,
      error
    );
    return defaults;
  }
}

/**
 * Calculate analytics from posts
 */
function calculatePostAnalytics(posts: any[]): PostAnalytics {
  const analytics: PostAnalytics = {
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

  if (posts.length === 0) {
    return analytics;
  }

  let totalCharacterCount = 0;
  let totalHashtagCount = 0;
  let totalEmojiCount = 0;

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

    // Accumulate for averages
    totalCharacterCount += post.metadata?.characterCount || 0;
    totalHashtagCount += post.metadata?.hashtagCount || 0;
    totalEmojiCount += post.metadata?.emojiCount || 0;
  });

  // Calculate averages
  analytics.averageCharacterCount = Math.round(
    totalCharacterCount / posts.length
  );
  analytics.averageHashtagCount = Math.round(totalHashtagCount / posts.length);
  analytics.averageEmojiCount = Math.round(totalEmojiCount / posts.length);

  return analytics;
}

/**
 * Normalize platforms array
 */
function normalizePlatforms(
  platforms: string | string[] | undefined
): string[] {
  if (Array.isArray(platforms)) {
    return platforms;
  }
  if (typeof platforms === "string") {
    return [platforms];
  }
  return ["instagram", "facebook", "linkedin"];
}

// ==================== CONTROLLER FUNCTIONS ====================

export const generateDynamicPosts = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      // Validate request body
      const validationResult = generateDynamicPostsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return ResponseHelper.badRequest(
          res,
          "Validation failed",
          formatValidationErrors(validationResult.error)
        );
      }

      const { topic, keyPoints, platforms, userContext } =
        validationResult.data;

      // Get user context from settings
      const userContextFromSettings = await getUserContext(userId);
      const finalUserContext = {
        ...userContextFromSettings,
        ...userContext,
      };

      // Generate dynamic posts
      const generatedPosts =
        await DynamicPostGenerationService.generateDynamicPosts(
          topic,
          keyPoints,
          finalUserContext,
          userId,
          platforms,
          userContextFromSettings.language
        );

      return ResponseHelper.success(
        res,
        "Dynamic posts generated successfully",
        {
          posts: generatedPosts,
          totalPosts: generatedPosts.length,
          platforms: platforms,
          topic: topic,
          userContext: finalUserContext,
        }
      );
    } catch (error) {
      return ResponseHelper.serverError(
        res,
        error instanceof Error
          ? error.message
          : "Failed to generate dynamic posts"
      );
    }
  }
);

export const getPostHistory = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      // Validate query parameters
      const validationResult = getPostHistoryQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        return ResponseHelper.badRequest(
          res,
          "Validation failed",
          formatValidationErrors(validationResult.error)
        );
      }

      const { platform, limit = 10 } = validationResult.data;

      const query: any = { userId };
      if (platform) {
        query.platform = platform;
      }

      const posts = await UserPostHistory.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return ResponseHelper.success(
        res,
        "Post history retrieved successfully",
        {
          posts,
          totalPosts: posts.length,
          platform: platform || "all",
        }
      );
    } catch (error) {
      return ResponseHelper.serverError(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve post history"
      );
    }
  }
);

export const getPostAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      // Validate query parameters
      const validationResult = getPostAnalyticsQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        return ResponseHelper.badRequest(
          res,
          "Validation failed",
          formatValidationErrors(validationResult.error)
        );
      }

      const { platform, days = 30 } = validationResult.data;

      const query: any = { userId };
      if (platform) {
        query.platform = platform;
      }

      // Get posts from last N days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      query.createdAt = { $gte: startDate };

      const posts = await UserPostHistory.find(query).lean();

      // Calculate analytics
      const analytics = calculatePostAnalytics(posts);

      return ResponseHelper.success(
        res,
        "Post analytics retrieved successfully",
        {
          analytics,
          period: `${days} days`,
          platform: platform || "all",
        }
      );
    } catch (error) {
      return ResponseHelper.serverError(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve post analytics"
      );
    }
  }
);

export const getTemplates = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      // Validate query parameters
      const validationResult = getTemplatesQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        return ResponseHelper.badRequest(
          res,
          "Validation failed",
          formatValidationErrors(validationResult.error)
        );
      }

      const { platform, variant } = validationResult.data;

      const query: any = { isActive: true };
      if (platform) {
        query.platform = platform;
      }
      if (variant !== undefined) {
        query.variant = variant;
      }

      const templates = await ContentTemplate.find(query).lean();

      return ResponseHelper.success(res, "Templates retrieved successfully", {
        templates,
        totalTemplates: templates.length,
        platform: platform || "all",
      });
    } catch (error) {
      return ResponseHelper.serverError(
        res,
        error instanceof Error ? error.message : "Failed to retrieve templates"
      );
    }
  }
);

export const testDynamicPosts = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validationResult = testDynamicPostsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return ResponseHelper.badRequest(
          res,
          "Validation failed",
          formatValidationErrors(validationResult.error)
        );
      }

      const { topic, keyPoints, platforms, userContext } =
        validationResult.data;

      const testUserId = "507f1f77bcf86cd799439011"; // Test user ID
      const testUserContext = {
        name: "Sarah Johnson",
        position: "Real Estate Agent",
        companyName: "Austin Realty Group",
        city: "Austin",
        socialHandles: "@sarahjohnson_realty",
        ...userContext,
      };

      const platformsArray = normalizePlatforms(platforms);

      // Generate dynamic posts
      const generatedPosts =
        await DynamicPostGenerationService.generateDynamicPosts(
          topic,
          keyPoints,
          testUserContext,
          testUserId,
          platformsArray
        );

      return ResponseHelper.success(
        res,
        "Test dynamic posts generated successfully",
        {
          posts: generatedPosts,
          totalPosts: generatedPosts.length,
          platforms: platformsArray,
          topic: topic,
          userContext: testUserContext,
        }
      );
    } catch (error) {
      return ResponseHelper.serverError(
        res,
        error instanceof Error
          ? error.message
          : "Failed to generate test dynamic posts"
      );
    }
  }
);

export const enhanceScheduleWithDynamicPosts = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      // Validate route parameters
      const paramValidation = scheduleIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        return ResponseHelper.badRequest(
          res,
          "Validation failed",
          formatValidationErrors(paramValidation.error)
        );
      }

      const { scheduleId } = paramValidation.data;

      return ResponseHelper.success(
        res,
        "Schedule enhancement endpoint ready",
        {
          scheduleId,
          userId,
          note: "This endpoint will enhance existing schedules with dynamic posts",
        }
      );
    } catch (error) {
      return ResponseHelper.serverError(
        res,
        error instanceof Error ? error.message : "Failed to enhance schedule"
      );
    }
  }
);
