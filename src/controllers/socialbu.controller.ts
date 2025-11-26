import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types";
import socialBuService, {
  socialBuAccountService,
  socialBuPostsService,
  socialBuInsightsService,
  webhookService,
} from "../services/socialbu";
import { asyncHandler } from "../middleware/asyncHandler";
import { ResponseHelper } from "../utils/responseHelper";
import {
  saveTokenSchema,
  connectAccountSchema,
  getPostsSchema,
  getInsightsSchema,
  getScheduledPostsSchema,
} from "../validations/socialbu.validations";

// ==================== CONSTANTS ====================
const DEFAULT_POSTBACK_URL = "http://localhost:4000/api/webhook/socialbu";

// ==================== HELPER FUNCTIONS ====================
/**
 * Get user ID from authenticated request
 */
function getUserIdFromRequest(req: AuthenticatedRequest): string {
  if (!req.user?._id) {
    throw new Error("User not authenticated");
  }
  return req.user._id.toString();
}

/**
 * Extract access token from request headers
 */
function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.replace("Bearer ", "") || null;
}

/**
 * Normalize account IDs to numbers
 */
function normalizeAccountIds(accountIds: (string | number)[]): number[] {
  return accountIds.map((id) => Number(id));
}

/**
 * Build user-specific postback URL
 */
function buildUserPostbackUrl(
  userId: string,
  postbackUrl?: string
): string {
  const baseUrl = postbackUrl || DEFAULT_POSTBACK_URL;
  return `${baseUrl}?user_id=${userId}`;
}

/**
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("token") ||
    message.includes("not authenticated") ||
    message.includes("user not found") ||
    message.includes("unauthorized")
  ) {
    return 401;
  }
  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Manual login to SocialBu and save token
 * POST /api/socialbu/login
 */
export const manualLogin = async (req: Request, res: Response) => {
  try {
    const result = await socialBuService.manualLogin();

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message || "Login failed");
    }

    return ResponseHelper.success(res, result.message || "Login successful", result.data);
  } catch (error: any) {
    console.error("Error in manualLogin:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to login to SocialBu",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Save token manually (for initial setup)
 * POST /api/socialbu/save-token
 */
export const saveToken = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = saveTokenSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { authToken, id, name, email, verified } = validationResult.data;

    const result = await socialBuService.saveToken({
      authToken,
      id: typeof id === "string" ? parseInt(id, 10) : id,
      name,
      email,
      verified,
    });

    if (!result) {
      return ResponseHelper.serverError(res, "Failed to save token");
    }

    return ResponseHelper.success(res, "Token saved successfully", {
      id: result.id,
      name: result.name,
      email: result.email,
      verified: result.verified,
      isActive: result.isActive,
      createdAt: result.createdAt,
    });
  } catch (error: any) {
    console.error("Error in saveToken:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to save token",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get accounts from SocialBu
 * GET /api/socialbu/accounts
 */
export const getAccounts = asyncHandler(
  async (req: Request, res: Response) => {
    const token = extractAccessToken(req);

    if (!token) {
      return ResponseHelper.unauthorized(res, "Access token is required");
    }

    const result = await socialBuAccountService.getUserAccounts(token);

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message || "Failed to get accounts", result.error);
    }

    return ResponseHelper.success(
      res,
      "User accounts retrieved successfully",
      result.data
    );
  }
);

/**
 * Get SocialBu accounts (Protected endpoint - requires authentication)
 * Returns only the user's connected accounts
 * GET /api/socialbu/accounts/public
 */
export const getAccountsPublic = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = getUserIdFromRequest(req);

    // Get all SocialBu accounts
    let socialBuResult = await socialBuService.getAccounts();

    // If still not successful, try one more time with fresh login
    if (!socialBuResult.success) {
      // Try to login and get fresh token
      const loginResult = await socialBuService.manualLogin();

      if (loginResult.success) {
        // Try again with fresh token
        socialBuResult = await socialBuService.getAccounts();
      }
    }

    // Get user's connected account IDs
    const userResult = await webhookService.getUserSocialBuAccounts(userId);

    if (!userResult.success) {
      return ResponseHelper.badRequest(res, userResult.message);
    }

    const userAccountIds = userResult.data?.socialbu_account_ids || [];

    // If SocialBu accounts are not available, return user's account IDs
    if (!socialBuResult.success) {
      return ResponseHelper.success(
        res,
        "User connected accounts retrieved successfully",
        {
          connected_accounts: [],
          user_account_ids: userAccountIds,
          total_connected: userAccountIds.length,
          socialbu_status: "unavailable",
        }
      );
    }

    // Filter SocialBu accounts to only show user's connected accounts
    const connectedAccounts =
      socialBuResult.data?.filter((account: any) =>
        userAccountIds.includes(account.id)
      ) || [];

    return ResponseHelper.success(
      res,
      "User SocialBu accounts retrieved successfully",
      {
        connected_accounts: connectedAccounts,
        user_account_ids: userAccountIds,
        total_connected: connectedAccounts.length,
        socialbu_status: "available",
      }
    );
  } catch (error: any) {
    console.error("Error in getAccountsPublic:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get user SocialBu accounts",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Connect new social media account to SocialBu
 * POST /api/socialbu/connect
 */
export const connectAccount = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    // Validate request body
    const validationResult = connectAccountSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { provider, postback_url, account_id, user_id } =
      validationResult.data;

    // Get user ID from auth or body
    const userId = req.user?._id?.toString() || user_id;

    if (!userId) {
      return ResponseHelper.badRequest(
        res,
        "User ID is required (either through authentication or user_id in body)"
      );
    }

    // Create user-specific postback URL
    const userSpecificPostbackUrl = buildUserPostbackUrl(userId, postback_url);

    const result = await socialBuService.connectAccount(
      provider,
      userSpecificPostbackUrl,
      account_id
    );

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message || "Failed to connect account", result.error);
    }

    return ResponseHelper.success(res, "Account connected successfully", result.data);
  } catch (error: any) {
    console.error("Error in connectAccount:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to connect account",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Test authentication
 * GET /api/socialbu/test-auth
 */
export const testAuth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const accessToken = extractAccessToken(req);

    return ResponseHelper.success(res, "Authentication test successful", {
      user: req.user,
      hasUser: !!req.user,
      userId: req.user?._id,
      hasToken: !!accessToken,
      tokenLength: accessToken?.length,
    });
  } catch (error: any) {
    console.error("Error in testAuth:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Test auth failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get posts from SocialBu
 * POST /api/socialbu/posts
 */
export const getPosts = asyncHandler(async (req: Request, res: Response) => {
  const token = extractAccessToken(req);

  if (!token) {
    return ResponseHelper.unauthorized(res, "Access token is required");
  }

  // Validate request body
  const validationResult = getPostsSchema.safeParse(req.body);
  if (!validationResult.success) {
    const errors = validationResult.error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));
    return ResponseHelper.badRequest(res, "Validation failed", errors);
  }

  const { type, account_id, limit, offset } = validationResult.data;

  const requestData: any = {};
  if (type) requestData.type = type;
  if (account_id) requestData.account_id = parseInt(account_id as string);
  if (limit) requestData.limit = parseInt(limit as string);
  if (offset) requestData.offset = parseInt(offset as string);

    const result = await socialBuPostsService.getUserPosts(token, requestData);

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message || "Failed to get posts", result.error);
    }

  return ResponseHelper.success(
    res,
    "User data and posts retrieved successfully",
    result.data
  );
});

/**
 * Get insights from SocialBu
 * POST /api/socialbu/insights
 */
export const getInsights = asyncHandler(
  async (req: Request, res: Response) => {
    const token = extractAccessToken(req);

    if (!token) {
      return ResponseHelper.unauthorized(res, "Access token is required");
    }

    // Validate request body
    const validationResult = getInsightsSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { start, end, metrics } = validationResult.data;

    const requestData: any = {
      start,
      end,
      metrics,
    };

    const result = await socialBuInsightsService.getTopPosts(
      token,
      requestData
    );

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message || "Failed to get insights", result.error);
    }

    return ResponseHelper.success(
      res,
      "User top posts retrieved successfully",
      result.data
    );
  }
);

/**
 * Get scheduled posts from SocialBu
 * POST /api/socialbu/posts/scheduled
 */
export const getScheduledPosts = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    // Validate request body (optional user_id)
    const validationResult = getScheduledPostsSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    // Get user ID from auth or body
    const userId = req.user?._id?.toString() || validationResult.data.user_id;

    if (!userId) {
      return ResponseHelper.badRequest(
        res,
        "User ID is required (either through authentication or user_id in body)"
      );
    }

    // Get user's SocialBu account IDs
    const userResult = await webhookService.getUserSocialBuAccounts(userId);

    if (!userResult.success) {
      return ResponseHelper.badRequest(res, userResult.message);
    }

    const userAccountIds = userResult.data?.socialbu_account_ids || [];

    // Ensure all account IDs are numbers
    const normalizedAccountIds = normalizeAccountIds(userAccountIds);

    // Get scheduled posts filtered by user's account IDs
    const result = await socialBuService.getScheduledPosts(normalizedAccountIds);

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message || "Failed to get scheduled posts", result.error);
    }

    return ResponseHelper.success(
      res,
      result.message || "Scheduled posts retrieved successfully",
      {
        ...result.data,
        meta: {
          user_account_ids: userAccountIds,
          total_posts:
            result.data?.items?.length || result.data?.total || 0,
          filtered: userAccountIds.length > 0,
          original_total:
            result.data?.originalTotal || result.data?.total || 0,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in getScheduledPosts:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get scheduled posts",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Test SocialBu API connection
 * GET /api/socialbu/test-connection
 */
export const testConnection = async (req: Request, res: Response) => {
  try {
    const token = await socialBuService.getValidToken();

    if (!token) {
      return ResponseHelper.badRequest(
        res,
        "No valid token available. Please login first."
      );
    }

    return ResponseHelper.success(res, "SocialBu API connection successful", {
      hasToken: true,
      tokenLength: token.length,
    });
  } catch (error: any) {
    console.error("Error in testConnection:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to test connection",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
