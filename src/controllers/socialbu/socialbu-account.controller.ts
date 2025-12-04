import { Response } from "express";
import { AuthenticatedRequest } from "../../types";
import { webhookService } from "../../services/socialbu";
import { userConnectedAccountService } from "../../services/user";
import { ResponseHelper } from "../../utils/responseHelper";
import { accountIdParamSchema } from "../../validations/socialbuAccount.validations";
import {
  getUserIdFromRequest,
  formatValidationErrors,
  handleControllerError,
} from "../../utils/controllerHelpers";
import { parseAccountId } from "../../utils/socialbuHelpers";

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Disconnect a user's SocialBu account by account ID
 * DELETE /api/socialbu-account/:accountId
 */
export const disconnectAccount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  try {
    const userId = getUserIdFromRequest(req);
    const { accountId } = req.params;

    // Validate accountId parameter
    const validationResult = accountIdParamSchema.safeParse({ accountId });
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
      const { socialBuService } = await import("../../services/socialbu");
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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "disconnectAccount",
      "Failed to disconnect account"
    );
  }
};

/**
 * Check if user has a specific account
 * GET /api/socialbu-account/:accountId/check
 */
export const checkAccount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  try {
    const userId = getUserIdFromRequest(req);
    const { accountId } = req.params;

    // Validate accountId parameter
    const validationResult = accountIdParamSchema.safeParse({ accountId });
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "checkAccount",
      "Failed to check account"
    );
  }
};
