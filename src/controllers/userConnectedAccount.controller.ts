import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { asyncHandler } from "../middleware/asyncHandler";
import { ResponseHelper } from "../utils/responseHelper";
import { userConnectedAccountService } from "../services/user";
import {
  accountTypeParamSchema,
  socialbuAccountIdParamSchema,
} from "../validations/userConnectedAccount.validations";
import {
  getUserIdFromRequest,
  extractAccessToken,
  formatValidationErrors,
  handleControllerError,
} from "../utils/controllerHelpers";

// ==================== HELPER FUNCTIONS ====================
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

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Get all connected accounts for the authenticated user
 * GET /api/user-connected-accounts
 */
export const getUserConnectedAccounts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = getUserIdFromRequest(req);

      const accounts =
        await userConnectedAccountService.getUserConnectedAccounts(userId);

      return ResponseHelper.success(
        res,
        "User connected accounts retrieved successfully",
        accounts
      );
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "getUserConnectedAccounts",
        "Failed to get user connected accounts"
      );
    }
  }
);

/**
 * Get connected accounts by type for the authenticated user
 * GET /api/user-connected-accounts/type/:type
 */
export const getUserConnectedAccountsByType = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = getUserIdFromRequest(req);
      const { type } = req.params;

      // Validate type parameter
      const validationResult = accountTypeParamSchema.safeParse({ type });
      if (!validationResult.success) {
        const errors = formatValidationErrors(validationResult.error);
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
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "getUserConnectedAccountsByType",
        "Failed to get user connected accounts by type"
      );
    }
  }
);

/**
 * Get account statistics for the authenticated user
 * GET /api/user-connected-accounts/stats
 */
export const getUserAccountStats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
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
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "getUserAccountStats",
        "Failed to get user account statistics"
      );
    }
  }
);

/**
 * Sync user connected accounts from SocialBu API
 * POST /api/user-connected-accounts/sync
 */
export const syncUserConnectedAccounts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = getUserIdFromRequest(req);

      // Get access token
      const token = extractAccessToken(req);
      if (!token) {
        return ResponseHelper.unauthorized(res, "Access token is required");
      }

      // Get user's accounts from SocialBu API
      const { socialBuAccountService } = await import(
        "../services/socialbu"
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
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "syncUserConnectedAccounts",
        "Failed to sync user connected accounts"
      );
    }
  }
);

/**
 * Deactivate a connected account
 * PUT /api/user-connected-accounts/:socialbuAccountId/deactivate
 */
export const deactivateConnectedAccount = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = getUserIdFromRequest(req);
      const { socialbuAccountId } = req.params;

      // Validate socialbuAccountId parameter
      const validationResult = socialbuAccountIdParamSchema.safeParse({
        socialbuAccountId,
      });
      if (!validationResult.success) {
        const errors = formatValidationErrors(validationResult.error);
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
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "deactivateConnectedAccount",
        "Failed to deactivate connected account"
      );
    }
  }
);

/**
 * Delete a connected account permanently
 * DELETE /api/user-connected-accounts/:socialbuAccountId
 */
export const deleteConnectedAccount = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = getUserIdFromRequest(req);
      const { socialbuAccountId } = req.params;

      // Validate socialbuAccountId parameter
      const validationResult = socialbuAccountIdParamSchema.safeParse({
        socialbuAccountId,
      });
      if (!validationResult.success) {
        const errors = formatValidationErrors(validationResult.error);
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
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "deleteConnectedAccount",
        "Failed to delete connected account"
      );
    }
  }
);

/**
 * Update last used timestamp for an account
 * PUT /api/user-connected-accounts/:socialbuAccountId/last-used
 */
export const updateAccountLastUsed = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = getUserIdFromRequest(req);
      const { socialbuAccountId } = req.params;

      // Validate socialbuAccountId parameter
      const validationResult = socialbuAccountIdParamSchema.safeParse({
        socialbuAccountId,
      });
      if (!validationResult.success) {
        const errors = formatValidationErrors(validationResult.error);
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
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "updateAccountLastUsed",
        "Failed to update account last used timestamp"
      );
    }
  }
);
