import User from '../models/User';
import { connectMongo } from '../config/mongoose';

interface SocialBuWebhookData {
  account_action: string;
  account_id: number;
  account_type: string;
  account_name: string;
}

interface WebhookResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

class WebhookService {
  private static instance: WebhookService;

  private constructor() {}

  public static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  /**
   * Handle SocialBu account webhook
   */
  async handleSocialBuAccountWebhook(webhookData: SocialBuWebhookData, userId?: string): Promise<WebhookResponse> {
    try {
      await connectMongo();

      console.log('Processing SocialBu webhook:', webhookData, 'for user:', userId);

      const { account_action, account_id, account_type, account_name } = webhookData;

      if (account_action === 'added' || account_action === 'updated') {
        // Add account_id to specific user if userId is provided, otherwise add to all users
        const updateQuery = userId 
          ? { _id: userId }
          : {}; // Update all users if no specific user ID

        const result = await User.updateMany(
          updateQuery,
          { 
            $addToSet: { 
              socialbu_account_ids: account_id 
            } 
          }
        );

        console.log(`${account_action === 'updated' ? 'Updated' : 'Added'} account ${account_id} to ${result.modifiedCount} user(s)`);

        return {
          success: true,
          message: `Account ${account_id} (${account_name}) ${account_action === 'updated' ? 'updated' : 'added'} successfully${userId ? ` to user ${userId}` : ' to all users'}`,
          data: {
            account_id,
            account_name,
            account_type,
            users_updated: result.modifiedCount,
            target_user: userId || 'all_users'
          }
        };
      } else if (account_action === 'removed') {
        // Remove account_id from specific user if userId is provided, otherwise remove from all users
        const updateQuery = userId 
          ? { _id: userId }
          : {}; // Update all users if no specific user ID

        const result = await User.updateMany(
          updateQuery,
          { 
            $pull: { 
              socialbu_account_ids: account_id 
            } 
          }
        );

        console.log(`Removed account ${account_id} from ${result.modifiedCount} user(s)`);

        return {
          success: true,
          message: `Account ${account_id} (${account_name}) removed successfully${userId ? ` from user ${userId}` : ' from all users'}`,
          data: {
            account_id,
            account_name,
            account_type,
            users_updated: result.modifiedCount,
            target_user: userId || 'all_users'
          }
        };
      } else {
        return {
          success: false,
          message: `Unknown account action: ${account_action}`
        };
      }
    } catch (error) {
      console.error('Error processing SocialBu webhook:', error);
      return {
        success: false,
        message: 'Failed to process webhook',
        data: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user's SocialBu account IDs
   */
  async getUserSocialBuAccounts(userId: string): Promise<WebhookResponse> {
    try {
      await connectMongo();

      const user = await User.findById(userId).select('socialbu_account_ids');
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      return {
        success: true,
        message: 'SocialBu accounts retrieved successfully',
        data: {
          socialbu_account_ids: user.socialbu_account_ids || []
        }
      };
    } catch (error) {
      console.error('Error getting user SocialBu accounts:', error);
      return {
        success: false,
        message: 'Failed to get SocialBu accounts',
        data: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove specific SocialBu account from user
   */
  async removeUserSocialBuAccount(userId: string, accountId: number): Promise<WebhookResponse> {
    try {
      await connectMongo();

      const result = await User.findByIdAndUpdate(
        userId,
        { 
          $pull: { 
            socialbu_account_ids: accountId 
          } 
        },
        { new: true }
      );

      if (!result) {
        return {
          success: false,
          message: 'User not found'
        };
      }

    return {
      success: true,
        message: `Account ${accountId} removed successfully`,
      data: {
          socialbu_account_ids: result.socialbu_account_ids || []
        }
      };
    } catch (error) {
      console.error('Error removing SocialBu account:', error);
      return {
        success: false,
        message: 'Failed to remove SocialBu account',
        data: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if user has a specific SocialBu account ID
   */
  async checkUserHasAccount(userId: string, accountId: number): Promise<WebhookResponse> {
    try {
      await connectMongo();

      console.log(`Checking if user ${userId} has account ${accountId}`);

      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          error: 'User not found'
        };
      }

      const hasAccount = user.socialbu_account_ids && user.socialbu_account_ids.includes(accountId);

      return {
        success: true,
        message: hasAccount ? 'User has this account' : 'User does not have this account',
        data: {
          userId,
          accountId,
          hasAccount,
          userAccounts: user.socialbu_account_ids || []
        }
      };
    } catch (error) {
      console.error('Error checking user account:', error);
      return {
        success: false,
        message: 'Failed to check user account',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default WebhookService.getInstance();