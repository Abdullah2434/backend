import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { asyncHandler } from "../middleware/asyncHandler";
import { ResponseHelper } from "../utils/responseHelper";
import { userConnectedAccountService } from "../services/userConnectedAccount.service";
import {
  accountTypeParamSchema,
  socialbuAccountIdParamSchema,
} from "../validations/userConnectedAccount.validations";

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
function extractAccessToken(req: AuthenticatedRequest): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.replace("Bearer ", "") || null;
}

/**
 * Parse socialbuAccountId from string to number
 */
function parseSocialbuAccountId(socialbuAccountId: string): number {
  const parsed = parseInt(socialbuAccountId, 10);
  if (isNaN(parsed)) {
    throw new Error("SocialBu account ID must be a valid number");
  }
  return parsed;
}

/**
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("token") ||
    message.includes("not authenticated") ||
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
 * Get all connected accounts for the authenticated user
 * GET /api/user-connected-accounts
 */
export const getUserConnectedAccounts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);

      const accounts =
        await userConnectedAccountService.getUserConnectedAccounts(userId);

      return ResponseHelper.success(
        res,
        "User connected accounts retrieved successfully",
        accounts
      );
    } catch (error: any) {
      console.error("Error in getUserConnectedAccounts:", error);
      const status = getErrorStatus(error);
      return res.status(status).json({
        success: false,
        message: error.message || "Failed to get user connected accounts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Get connected accounts by type for the authenticated user
 * GET /api/user-connected-accounts/type/:type
 */
export const getUserConnectedAccountsByType = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      const { type } = req.params;

      // Validate type parameter
      const validationResult = accountTypeParamSchema.safeParse({ type });
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return ResponseHelper.badRequest(res, "Validation failed", errors);
      }

      const accounts =
        await userConnectedAccountService.getUserConnectedAccountsByType(
          userId,
          validationResult.data.type
        );

      return ResponseHelper.success(
        res,
        `User connected ${validationResult.data.type} accounts retrieved successfully`,
        accounts
      );
    } catch (error: any) {
      console.error("Error in getUserConnectedAccountsByType:", error);
      const status = getErrorStatus(error);
      return res.status(status).json({
        success: false,
        message:
          error.message || "Failed to get user connected accounts by type",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Get account statistics for the authenticated user
 * GET /api/user-connected-accounts/stats
 */
export const getUserAccountStats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);

      const stats = await userConnectedAccountService.getUserAccountStats(
        userId
      );

      return ResponseHelper.success(
        res,
        "User account statistics retrieved successfully",
        stats
      );
    } catch (error: any) {
      console.error("Error in getUserAccountStats:", error);
      const status = getErrorStatus(error);
      return res.status(status).json({
        success: false,
        message: error.message || "Failed to get user account statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Sync user connected accounts from SocialBu API
 * POST /api/user-connected-accounts/sync
 */
export const syncUserConnectedAccounts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);

      // Get access token
      const token = extractAccessToken(req);
      if (!token) {
        return ResponseHelper.unauthorized(res, "Access token is required");
      }

      // Get user's accounts from SocialBu API
      const { socialBuAccountService } = await import(
        "../services/socialbu-account.service"
      );
      const result = await socialBuAccountService.getUserAccounts(token);

      if (!result.success || !result.data) {
        return ResponseHelper.badRequest(
          res,
          result.message || "Failed to sync accounts",
          result.error
        );
      }

      // Update local database with SocialBu accounts
      const updatedAccounts =
        await userConnectedAccountService.updateUserConnectedAccountsFromSocialBu(
          userId,
          result.data
        );

      return ResponseHelper.success(
        res,
        "User connected accounts synced successfully",
        {
          synced: updatedAccounts.length,
          accounts: updatedAccounts,
        }
      );
    } catch (error: any) {
      console.error("Error in syncUserConnectedAccounts:", error);
      const status = getErrorStatus(error);
      return res.status(status).json({
        success: false,
        message: error.message || "Failed to sync user connected accounts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Deactivate a connected account
 * PUT /api/user-connected-accounts/:socialbuAccountId/deactivate
 */
export const deactivateConnectedAccount = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      const { socialbuAccountId } = req.params;

      // Validate socialbuAccountId parameter
      const validationResult = socialbuAccountIdParamSchema.safeParse({
        socialbuAccountId,
      });
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return ResponseHelper.badRequest(res, "Validation failed", errors);
      }

      const accountId = parseSocialbuAccountId(
        validationResult.data.socialbuAccountId
      );

      const success =
        await userConnectedAccountService.deactivateUserConnectedAccount(
          userId,
          accountId
        );

      if (!success) {
        return ResponseHelper.notFound(res, "Connected account not found");
      }

      return ResponseHelper.success(
        res,
        "Connected account deactivated successfully",
        { socialbuAccountId: accountId }
      );
    } catch (error: any) {
      console.error("Error in deactivateConnectedAccount:", error);
      const status = getErrorStatus(error);
      return res.status(status).json({
        success: false,
        message: error.message || "Failed to deactivate connected account",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Delete a connected account permanently
 * DELETE /api/user-connected-accounts/:socialbuAccountId
 */
export const deleteConnectedAccount = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      const { socialbuAccountId } = req.params;

      // Validate socialbuAccountId parameter
      const validationResult = socialbuAccountIdParamSchema.safeParse({
        socialbuAccountId,
      });
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return ResponseHelper.badRequest(res, "Validation failed", errors);
      }

      const accountId = parseSocialbuAccountId(
        validationResult.data.socialbuAccountId
      );

      const success =
        await userConnectedAccountService.deleteUserConnectedAccount(
          userId,
          accountId
        );

      if (!success) {
        return ResponseHelper.notFound(res, "Connected account not found");
      }

      return ResponseHelper.success(
        res,
        "Connected account deleted successfully",
        { socialbuAccountId: accountId }
      );
    } catch (error: any) {
      console.error("Error in deleteConnectedAccount:", error);
      const status = getErrorStatus(error);
      return res.status(status).json({
        success: false,
        message: error.message || "Failed to delete connected account",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Update last used timestamp for an account
 * PUT /api/user-connected-accounts/:socialbuAccountId/last-used
 */
export const updateAccountLastUsed = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      const { socialbuAccountId } = req.params;

      // Validate socialbuAccountId parameter
      const validationResult = socialbuAccountIdParamSchema.safeParse({
        socialbuAccountId,
      });
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return ResponseHelper.badRequest(res, "Validation failed", errors);
      }

      const accountId = parseSocialbuAccountId(
        validationResult.data.socialbuAccountId
      );

      const success = await userConnectedAccountService.updateLastUsed(
        userId,
        accountId
      );

      if (!success) {
        return ResponseHelper.notFound(res, "Connected account not found");
      }

      return ResponseHelper.success(
        res,
        "Account last used timestamp updated successfully",
        { socialbuAccountId: accountId }
      );
    } catch (error: any) {
      console.error("Error in updateAccountLastUsed:", error);
      const status = getErrorStatus(error);
      return res.status(status).json({
        success: false,
        message:
          error.message || "Failed to update account last used timestamp",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);
