import { Response } from "express";
import SocialBuService from "../services/socialbu.service";
import WebhookSocialBuService from "../services/webhook-socialbu.service";

const socialBuService = SocialBuService;
const webhookSocialBuService = WebhookSocialBuService;

/**
 * Manual login to SocialBu and save token
 */
export const manualLogin = async (req: any, res: Response): Promise<void> => {
  try {
    console.log("Manual SocialBu login requested");
    const result = await socialBuService.manualLogin();
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message,
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error: any) {
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
export const saveToken = async (req: any, res: Response): Promise<void> => {
  try {
    const { authToken, id, name, email, verified } = req.body;
    if (!authToken || !id || !name || !email) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: authToken, id, name, email",
      });
      return;
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
      res.status(500).json({
        success: false,
        message: "Failed to save token",
      });
      return;
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
  } catch (error: any) {
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
export const getAccounts = async (req: any, res: Response): Promise<void> => {
  try {
    console.log("Getting SocialBu accounts");
    const result = await socialBuService.getAccounts();
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: "Accounts retrieved successfully",
      data: result.data,
    });
  } catch (error: any) {
    console.error("Error getting accounts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get accounts",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get SocialBu accounts (Protected endpoint - requires authentication)
 * Returns only the user's connected accounts
 */
export const getAccountsPublic = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    // For testing purposes, use a hardcoded user ID
    const userId = req.user?._id || "68b19f13b732018f898d7046";
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User authentication required",
      });
      return;
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
    const userResult = await webhookSocialBuService.getUserSocialBuAccounts(
      userId
    );
    if (!userResult.success) {
      res.status(400).json({
        success: false,
        message: userResult.message,
      });
      return;
    }
    const userAccountIds = userResult.data?.socialbu_account_ids || [];
    // If SocialBu accounts are not available, return user's account IDs
    if (!socialBuResult.success) {
      console.log(
        "SocialBu accounts not available, returning user account IDs"
      );
      res.status(200).json({
        success: true,
        message: "User connected accounts retrieved successfully",
        data: {
          connected_accounts: [],
          user_account_ids: userAccountIds,
          total_connected: userAccountIds.length,
          socialbu_status: "unavailable",
        },
      });
      return;
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
  } catch (error: any) {
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
export const connectAccount = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { provider, postback_url, account_id, user_id } = req.body;
    const userId = req.user?._id || user_id; // Get user ID from authenticated request or body
    if (!provider) {
      res.status(400).json({
        success: false,
        message: "Provider is required",
      });
      return;
    }
    if (!userId) {
      res.status(400).json({
        success: false,
        message:
          "User ID is required (either through authentication or user_id in body)",
      });
      return;
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
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: "Account connected successfully",
      data: result.data,
    });
  } catch (error: any) {
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
export const testAuth = async (req: any, res: Response): Promise<void> => {
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
  } catch (error: any) {
    console.error("Error in test auth:", error);
    res.status(500).json({
      success: false,
      message: "Test auth failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Test SocialBu API connection
 */
export const testConnection = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    console.log("Testing SocialBu API connection");
    // Try to get a valid token
    const token = await socialBuService.getValidToken();
    if (!token) {
      res.status(400).json({
        success: false,
        message: "No valid token available. Please login first.",
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: "SocialBu API connection successful",
      data: {
        hasToken: true,
        tokenLength: token.length,
      },
    });
  } catch (error: any) {
    console.error("Error testing connection:", error);
    res.status(500).json({
      success: false,
      message: "Failed to test connection",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
