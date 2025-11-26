import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { webhookService } from "../services/socialbu";
import { userConnectedAccountService } from "../services/user";
import { ResponseHelper } from "../utils/responseHelper";
import { accountIdParamSchema } from "../validations/socialbuAccount.validations";

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
 * Parse account ID from string to number
 */
function parseAccountId(accountId: string): number {
  const accountIdNumber = parseInt(accountId, 10);
  if (isNaN(accountIdNumber)) {
    throw new Error("Invalid account ID format. Must be a valid number");
  }
  return accountIdNumber;
}

/**
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("token") ||
    message.includes("not authenticated") ||
    message.includes("user not found")
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
 * Disconnect a user's SocialBu account by account ID
 * DELETE /api/socialbu-account/:accountId
 */
export const disconnectAccount = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { accountId } = req.params;

    // Validate accountId parameter
    const validationResult = accountIdParamSchema.safeParse({ accountId });
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const accountIdNumber = parseAccountId(accountId);

    // Check if user has this account
    const checkResult = await webhookService.checkUserHasAccount(
      userId,
      accountIdNumber
    );

    if (!checkResult.success) {
      return ResponseHelper.badRequest(
        res,
        checkResult.message,
        checkResult.error
      );
    }

    if (!checkResult.data?.hasAccount) {
      return ResponseHelper.notFound(
        res,
        "Account not found in user's connected accounts"
      );
    }

    // Call SocialBu API to disconnect the account
    try {
      const { socialBuService } = await import("../services/socialbu");
      await socialBuService.makeAuthenticatedRequest(
        "DELETE",
        `/accounts/${accountIdNumber}`
      );
    } catch (socialBuError) {
      console.error(
        "Failed to disconnect account from SocialBu API:",
        socialBuError
      );
      // Continue with local disconnection even if SocialBu API fails
    }

    // Remove the account from user's connected accounts
    const removeResult = await webhookService.removeUserSocialBuAccount(
      userId,
      accountIdNumber
    );

    if (!removeResult.success) {
      return ResponseHelper.badRequest(
        res,
        removeResult.message,
        removeResult.data
      );
    }

    // Also delete the account from UserConnectedAccount database
    try {
      await userConnectedAccountService.deleteUserConnectedAccount(
        userId,
        accountIdNumber
      );
    } catch (dbError) {
      console.error(
        "Failed to delete account from UserConnectedAccount:",
        dbError
      );
      // Don't fail the request if database update fails
    }

    return ResponseHelper.success(
      res,
      `Account ${accountId} disconnected successfully`,
      {
        accountId: accountIdNumber,
        userId,
        remainingAccounts: removeResult.data?.socialbu_account_ids || [],
      }
    );
  } catch (error: any) {
    console.error("Error in disconnectAccount:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to disconnect account",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Check if user has a specific account
 * GET /api/socialbu-account/:accountId/check
 */
export const checkAccount = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { accountId } = req.params;

    // Validate accountId parameter
    const validationResult = accountIdParamSchema.safeParse({ accountId });
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const accountIdNumber = parseAccountId(accountId);

    // Check if user has this account
    const result = await webhookService.checkUserHasAccount(
      userId,
      accountIdNumber
    );

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message, result.error);
    }

    return ResponseHelper.success(res, result.message, result.data);
  } catch (error: any) {
    console.error("Error in checkAccount:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to check account",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
