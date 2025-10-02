import { Request, Response } from "express";
import { socialBuAccountService } from "../services/account.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Get all accounts from SocialBu (public - uses shared token)
 */
export const getAccountsPublic = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await socialBuAccountService.getAccounts();

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message, result.error);
    }

    return ResponseHelper.success(
      res,
      "Accounts retrieved successfully",
      result.data
    );
  }
);

/**
 * Get accounts for authenticated user
 */
export const getAccounts = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return ResponseHelper.unauthorized(res, "User ID is required");
  }

  const result = await socialBuAccountService.getUserAccounts(userId);

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
 * Connect new social media account to SocialBu
 */
export const connectAccount = asyncHandler(
  async (req: Request, res: Response) => {
    const { provider, postback_url, account_id, user_id } = req.body;
    const userId = req.user?.id || user_id; // Get user ID from authenticated request or body

    if (!provider) {
      return ResponseHelper.badRequest(res, "Provider is required");
    }

    if (!userId) {
      return ResponseHelper.badRequest(
        res,
        "User ID is required (either through authentication or user_id in body)"
      );
    }

    // Create user-specific postback URL that includes user ID
    const userSpecificPostbackUrl = postback_url
      ? `${postback_url}?user_id=${userId}`
      : `${
          process.env.API_BASE_URL || "http://localhost:4000"
        }/api/webhook/socialbu?user_id=${userId}`;

    const result = await socialBuAccountService.connectAccount(
      provider,
      userSpecificPostbackUrl,
      account_id
    );

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message, result.error);
    }

    return ResponseHelper.success(
      res,
      "Account connected successfully",
      result.data
    );
  }
);

/**
 * Test SocialBu API connection
 */
export const testConnection = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await socialBuAccountService.testConnection();

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message, result.error);
    }

    return ResponseHelper.success(res, result.message, result.data);
  }
);
