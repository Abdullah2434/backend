import { Request, Response } from 'express';
import webhookService from '../services/webhooksocialbu.service';
import { userConnectedAccountService } from '../services/userConnectedAccount.service';

/**
 * Disconnect a user's SocialBu account by account ID
 */
export const disconnectAccount = async (req: Request, res: Response, token: string) => {
  try {
    const { accountId } = req.params;
    const authService = new (await import("../services/auth.service")).default();

    const user = await authService.getCurrentUser(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found or invalid token",
      });
    }

    const userId = user._id.toString();

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: 'Account ID is required'
      });
    }

    const accountIdNumber = parseInt(accountId, 10);
    if (isNaN(accountIdNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID format'
      });
    }

    console.log(`Disconnecting account ${accountId} for user ${userId}`);

    // First check if user has this account
    const checkResult = await webhookService.checkUserHasAccount(userId, accountIdNumber);
    
    if (!checkResult.success) {
      return res.status(400).json({
        success: false,
        message: checkResult.message,
        error: checkResult.error
      });
    }

    if (!checkResult.data?.hasAccount) {
      return res.status(404).json({
        success: false,
        message: 'Account not found in user\'s connected accounts',
        data: {
          accountId: accountIdNumber,
          userAccounts: checkResult.data?.userAccounts || []
        }
      });
    }

    // Call SocialBu API to disconnect the account
    try {
      const socialBuService = (await import("../services/socialbu.service")).default;
      const socialBuResult = await socialBuService.makeAuthenticatedRequest(
        'DELETE',
        `/accounts/${accountIdNumber}`
      );
      
      if (!socialBuResult.success) {
        console.warn(`Failed to disconnect account ${accountIdNumber} from SocialBu:`, socialBuResult.message);
        // Continue with local disconnection even if SocialBu API fails
      } else {
        console.log(`Account ${accountIdNumber} successfully disconnected from SocialBu`);
      }
    } catch (socialBuError) {
      console.error('Error calling SocialBu API to disconnect account:', socialBuError);
      // Continue with local disconnection even if SocialBu API fails
    }

    // Remove the account from user's connected accounts
    const removeResult = await webhookService.removeUserSocialBuAccount(userId, accountIdNumber);

    if (!removeResult.success) {
      return res.status(400).json({
        success: false,
        message: removeResult.message,
        error: removeResult.data
      });
    }

    // Also delete the account from UserConnectedAccount database
    if (removeResult.success) {
      try {
        await userConnectedAccountService.deleteUserConnectedAccount(userId, accountIdNumber);
        console.log(`Account ${accountIdNumber} deleted from UserConnectedAccount database for user ${userId}`);
      } catch (dbError) {
        console.error('Error deleting account from UserConnectedAccount database:', dbError);
        // Don't fail the request if database update fails
      }
    }

    res.status(200).json({
      success: true,
      message: `Account ${accountId} disconnected successfully`,
      data: {
        accountId: accountIdNumber,
        userId,
        remainingAccounts: removeResult.data?.socialbu_account_ids || []
      }
    });
  } catch (error) {
    console.error('Error disconnecting account:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect account',
      error: error instanceof Error ? error.message : 'Unknown error'
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
    const userId = req.user?._id || "68b19f13b732018f898d7046";

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: 'Account ID is required'
      });
    }

    const accountIdNumber = parseInt(accountId, 10);
    if (isNaN(accountIdNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID format'
      });
    }

    console.log(`Checking account ${accountId} for user ${userId}`);

    const result = await webhookService.checkUserHasAccount(userId, accountIdNumber);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error checking account:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to check account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
