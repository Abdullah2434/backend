import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { asyncHandler } from "../middleware/asyncHandler";
import { ResponseHelper } from "../utils/responseHelper";
import { userConnectedAccountService } from "../services/userConnectedAccount.service";
import {
  validateAccountTypeParam,
  validateSocialbuAccountIdParam,
} from "../validations/userConnectedAccount.validations";
import {
  getUserIdFromRequest,
  extractAccessToken,
  parseSocialbuAccountId,
  getErrorStatus,
} from "../utils/userConnectedAccountHelpers";

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

      // Validate type parameter
      const validationResult = validateAccountTypeParam(req.params);
      if (!validationResult.success) {
        return ResponseHelper.badRequest(
          res,
          "Validation failed",
          validationResult.errors
        );
      }

      const { type } = validationResult.data!;

      const accounts =
        await userConnectedAccountService.getUserConnectedAccountsByType(
          userId,
          type
        );

      return ResponseHelper.success(
        res,
        `User connected ${type} accounts retrieved successfully`,
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

      // Validate socialbuAccountId parameter
      const validationResult = validateSocialbuAccountIdParam(req.params);
      if (!validationResult.success) {
        return ResponseHelper.badRequest(
          res,
          "Validation failed",
          validationResult.errors
        );
      }

      const { socialbuAccountId } = validationResult.data!;
      const accountId = parseSocialbuAccountId(socialbuAccountId);

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

      // Validate socialbuAccountId parameter
      const validationResult = validateSocialbuAccountIdParam(req.params);
      if (!validationResult.success) {
        return ResponseHelper.badRequest(
          res,
          "Validation failed",
          validationResult.errors
        );
      }

      const { socialbuAccountId } = validationResult.data!;
      const accountId = parseSocialbuAccountId(socialbuAccountId);

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

      // Validate socialbuAccountId parameter
      const validationResult = validateSocialbuAccountIdParam(req.params);
      if (!validationResult.success) {
        return ResponseHelper.badRequest(
          res,
          "Validation failed",
          validationResult.errors
        );
      }

      const { socialbuAccountId } = validationResult.data!;
      const accountId = parseSocialbuAccountId(socialbuAccountId);

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
