import { Request, Response } from "express";
import webhookService from "../services/webhooksocialbu.service";

/**
 * Disconnect a user's SocialBu account by account ID
 */
export const disconnectAccount = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    // For testing purposes, use a hardcoded user ID
    const userId = req.user?.id || "68b19f13b732018f898d7046";

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: "Account ID is required",
      });
    }

    const accountIdNumber = parseInt(accountId, 10);
    if (isNaN(accountIdNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account ID format",
      });
    }

    console.log(`Disconnecting account ${accountId} for user ${userId}`);

    // First check if user has this account
    const checkResult = await webhookService.checkUserHasAccount(
      userId,
      accountIdNumber
    );

    if (!checkResult.success) {
      return res.status(400).json({
        success: false,
        message: checkResult.message,
        error: checkResult.error,
      });
    }

    if (!checkResult.data?.hasAccount) {
      return res.status(404).json({
        success: false,
        message: "Account not found in user's connected accounts",
        data: {
          accountId: accountIdNumber,
          userAccounts: checkResult.data?.userAccounts || [],
        },
      });
    }

    // Remove the account from user's connected accounts
    const removeResult = await webhookService.removeUserSocialBuAccount(
      userId,
      accountIdNumber
    );

    if (!removeResult.success) {
      return res.status(400).json({
        success: false,
        message: removeResult.message,
        error: removeResult.data,
      });
    }

    res.status(200).json({
      success: true,
      message: `Account ${accountId} disconnected successfully`,
      data: {
        accountId: accountIdNumber,
        userId,
        remainingAccounts: removeResult.data?.socialbu_account_ids || [],
      },
    });
  } catch (error) {
    console.error("Error disconnecting account:", error);

    res.status(500).json({
      success: false,
      message: "Failed to disconnect account",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Check if user has a specific account
 */
export const checkAccount = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    // For testing purposes, use a hardcoded user ID
    const userId = req.user?.id || "68b19f13b732018f898d7046";

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: "Account ID is required",
      });
    }

    const accountIdNumber = parseInt(accountId, 10);
    if (isNaN(accountIdNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account ID format",
      });
    }

    console.log(`Checking account ${accountId} for user ${userId}`);

    const result = await webhookService.checkUserHasAccount(
      userId,
      accountIdNumber
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
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error("Error checking account:", error);

    res.status(500).json({
      success: false,
      message: "Failed to check account",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
