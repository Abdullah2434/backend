import { Request, Response } from "express";
import socialBuService from "../services/socialbu.service";
import webhookService from "../services/webhooksocialbu.service";
import User from "../models/User";
import { asyncHandler } from "../middleware/asyncHandler";
import { ResponseHelper } from "../utils/responseHelper";
import { socialBuAccountService } from "../services/socialbu-account.service";
import { socialBuPostsService } from "../services/socialbu-posts.service";
import { socialBuInsightsService } from "../services/socialbu-insights.service";

/**
 * Manual login to SocialBu and save token
 */
export const manualLogin = async (req: Request, res: Response) => {
  try {
    console.log("Manual SocialBu login requested");

    const result = await socialBuService.manualLogin();

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error("Error in manual login:", error);

    res.status(500).json({
      success: false,
      message: "Failed to login to SocialBu",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Save token manually (for initial setup)
 */
export const saveToken = async (req: Request, res: Response) => {
  try {
    const { authToken, id, name, email, verified } = req.body;

    if (!authToken || !id || !name || !email) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: authToken, id, name, email",
      });
    }

    console.log("Saving SocialBu token manually");

    const result = await socialBuService.saveToken({
      authToken,
      id,
      name,
      email,
      verified: verified || false,
    });

    if (!result) {
      return res.status(500).json({
        success: false,
        message: "Failed to save token",
      });
    }

    res.status(200).json({
      success: true,
      message: "Token saved successfully",
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        verified: result.verified,
        isActive: result.isActive,
        createdAt: result.createdAt,
      },
    });
  } catch (error) {
    console.error("Error saving token:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save token",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get accounts from SocialBu
 */
export const getAccounts = asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return ResponseHelper.unauthorized(res, "Access token is required");
  }

  const result = await socialBuAccountService.getUserAccounts(token);

  if (!result.success) {
    return ResponseHelper.badRequest(res, result.message, result.error);
  }

  return ResponseHelper.success(
    res,
    "User accounts retrieved successfully",
    result.data
  );
});

/**
 * Get SocialBu accounts (Protected endpoint - requires authentication)
 * Returns only the user's connected accounts
 */
export const getAccountsPublic = async (req: Request, res: Response) => {
  try {
    // For testing purposes, use a hardcoded user ID
    const userId = req.user?._id || "68b19f13b732018f898d7046";

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    console.log("Getting SocialBu accounts for user:", userId);

    // Get all SocialBu accounts
    let socialBuResult = await socialBuService.getAccounts();

    // If still not successful, try one more time with fresh login
    if (!socialBuResult.success) {
      console.log("First attempt failed, trying fresh login...");

      // Try to login and get fresh token
      const loginResult = await socialBuService.manualLogin();

      if (loginResult.success) {
        console.log("Fresh login successful, retrying accounts...");
        // Try again with fresh token
        socialBuResult = await socialBuService.getAccounts();
      }
    }

    // Get user's connected account IDs
    const userResult = await webhookService.getUserSocialBuAccounts(userId);

    if (!userResult.success) {
      return res.status(400).json({
        success: false,
        message: userResult.message,
      });
    }

    const userAccountIds = userResult.data?.socialbu_account_ids || [];

    // If SocialBu accounts are not available, return user's account IDs
    if (!socialBuResult.success) {
      console.log(
        "SocialBu accounts not available, returning user account IDs"
      );
      return res.status(200).json({
        success: true,
        message: "User connected accounts retrieved successfully",
        data: {
          connected_accounts: [],
          user_account_ids: userAccountIds,
          total_connected: userAccountIds.length,
          socialbu_status: "unavailable",
        },
      });
    }

    // Filter SocialBu accounts to only show user's connected accounts
    const connectedAccounts =
      socialBuResult.data?.filter((account: any) =>
        userAccountIds.includes(account.id)
      ) || [];

    res.status(200).json({
      success: true,
      message: "User SocialBu accounts retrieved successfully",
      data: {
        connected_accounts: connectedAccounts,
        user_account_ids: userAccountIds,
        total_connected: connectedAccounts.length,
        socialbu_status: "available",
      },
    });
  } catch (error) {
    console.error("Error getting user SocialBu accounts:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get user SocialBu accounts",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Connect new social media account to SocialBu
 */
export const connectAccount = async (req: Request, res: Response) => {
  try {
    const { provider, postback_url, account_id, user_id } = req.body;
    const userId = req.user?._id || user_id; // Get user ID from authenticated request or body

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Provider is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message:
          "User ID is required (either through authentication or user_id in body)",
      });
    }

    // Create user-specific postback URL that includes user ID
    const userSpecificPostbackUrl = postback_url
      ? `${postback_url}?user_id=${userId}`
      : `http://localhost:4000/api/webhook/socialbu?user_id=${userId}`;

    console.log("Connecting new account:", {
      provider,
      postback_url: userSpecificPostbackUrl,
      account_id,
      userId,
    });

    const result = await socialBuService.connectAccount(
      provider,
      userSpecificPostbackUrl,
      account_id
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    res.status(200).json({
      success: true,
      message: "Account connected successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error connecting account:", error);

    res.status(500).json({
      success: false,
      message: "Failed to connect account",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Test authentication
 */
export const testAuth = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    console.log("Test auth request:", {
      user: req.user,
      hasUser: !!req.user,
      userId: req.user?._id,
      hasToken: !!accessToken,
      tokenLength: accessToken?.length,
    });

    res.status(200).json({
      success: true,
      message: "Authentication test successful",
      data: {
        user: req.user,
        hasUser: !!req.user,
        userId: req.user?._id,
        hasToken: !!accessToken,
        tokenLength: accessToken?.length,
      },
    });
  } catch (error) {
    console.error("Error in test auth:", error);
    res.status(500).json({
      success: false,
      message: "Test auth failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get posts from SocialBu
 */
export const getPosts = asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return ResponseHelper.unauthorized(res, "Access token is required");
  }

  // Extract parameters from request body
  const { type, account_id, limit, offset } = req.body;

  const requestData: any = {};
  if (type) requestData.type = type;
  if (account_id) requestData.account_id = parseInt(account_id as string);
  if (limit) requestData.limit = parseInt(limit as string);
  if (offset) requestData.offset = parseInt(offset as string);

  const result = await socialBuPostsService.getUserPosts(token, requestData);

  if (!result.success) {
    return ResponseHelper.badRequest(res, result.message, result.error);
  }

  return ResponseHelper.success(
    res,
    "User data and posts retrieved successfully",
    result.data
  );
});

/**
 * Get insights from SocialBu
 */
export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return ResponseHelper.unauthorized(res, "Access token is required");
  }

  // Extract parameters from request body
  const { start, end, metrics } = req.body;

  const requestData: any = {
    start,
    end,
    metrics,
  };

  const result = await socialBuInsightsService.getTopPosts(token, requestData);

  if (!result.success) {
    return ResponseHelper.badRequest(res, result.message, result.error);
  }

  return ResponseHelper.success(
    res,
    "User top posts retrieved successfully",
    result.data
  );
});

/**
 * Get scheduled posts from SocialBu
 */
export const getScheduledPosts = async (req: Request, res: Response) => {
  try {
    console.log("Getting scheduled posts from SocialBu...");

    // Get user ID from authenticated request or body
    const userId = req.user?._id || req.body.user_id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message:
          "User ID is required (either through authentication or user_id in body)",
      });
    }

    console.log(`Getting scheduled posts for user: ${userId}`);

    // Get user's SocialBu account IDs
    const userResult = await webhookService.getUserSocialBuAccounts(userId);

    if (!userResult.success) {
      return res.status(400).json({
        success: false,
        message: userResult.message,
      });
    }

    const userAccountIds = userResult.data?.socialbu_account_ids || [];
    console.log(
      `User has ${
        userAccountIds.length
      } connected SocialBu accounts: ${userAccountIds.join(", ")}`
    );

    // Get scheduled posts filtered by user's account IDs
    const result = await socialBuService.getScheduledPosts(userAccountIds);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message || "Scheduled posts retrieved successfully",
      data: result.data,
      meta: {
        user_account_ids: userAccountIds,
        total_posts: result.data?.items?.length || result.data?.total || 0,
        filtered: userAccountIds.length > 0,
        original_total: result.data?.originalTotal || result.data?.total || 0,
      },
    });
  } catch (error) {
    console.error("Error getting scheduled posts:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get scheduled posts",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Test SocialBu API connection
 */
export const testConnection = async (req: Request, res: Response) => {
  try {
    console.log("Testing SocialBu API connection");

    // Try to get a valid token
    const token = await socialBuService.getValidToken();

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "No valid token available. Please login first.",
      });
    }

    res.status(200).json({
      success: true,
      message: "SocialBu API connection successful",
      data: {
        hasToken: true,
        tokenLength: token.length,
      },
    });
  } catch (error) {
    console.error("Error testing connection:", error);

    res.status(500).json({
      success: false,
      message: "Failed to test connection",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
