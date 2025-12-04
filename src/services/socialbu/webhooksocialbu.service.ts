import User from '../../models/User';
import { connectMongo } from '../../config/mongoose';
import { SocialBuWebhookData, WebhookResponse } from '../../types/services/webhookSocialbu.types';
import {
  buildUserUpdateQuery,
  buildAccountAddedResponse,
  buildAccountRemovedResponse,
  buildUnknownActionResponse,
  buildErrorWebhookResponse,
  buildSuccessWebhookResponse,
  buildUserAccountCheckResponse,
  validateWebhookData,
  userHasAccount,
} from '../../utils/webhookSocialbuHelpers';

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

      // Validate webhook data
      const validation = validateWebhookData(webhookData);
      if (!validation.valid) {
        return buildErrorWebhookResponse(
          'Invalid webhook data',
          validation.error
        );
      }

      const { account_action, account_id, account_type, account_name } = webhookData;

      if (account_action === 'added' || account_action === 'updated') {
        // Add account_id to specific user if userId is provided, otherwise add to all users
        const updateQuery = buildUserUpdateQuery(userId);

        const result = await User.updateMany(
          updateQuery,
          { 
            $addToSet: { 
              socialbu_account_ids: account_id 
            } 
          }
        );

        return buildAccountAddedResponse(
          account_id,
          account_name,
          account_type,
          result.modifiedCount,
          userId,
          account_action === 'updated'
        );
      } else if (account_action === 'removed') {
        // Remove account_id from specific user if userId is provided, otherwise remove from all users
        const updateQuery = buildUserUpdateQuery(userId);

        const result = await User.updateMany(
          updateQuery,
          { 
            $pull: { 
              socialbu_account_ids: account_id 
            } 
          }
        );

        return buildAccountRemovedResponse(
          account_id,
          account_name,
          account_type,
          result.modifiedCount,
          userId
        );
      } else {
        return buildUnknownActionResponse(account_action);
      }
    } catch (error) {
      return buildErrorWebhookResponse(
        'Failed to process webhook',
        error instanceof Error ? error : undefined
      );
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
        return buildErrorWebhookResponse('User not found');
      }

      return buildSuccessWebhookResponse(
        'SocialBu accounts retrieved successfully',
        {
          socialbu_account_ids: user.socialbu_account_ids || []
        }
      );
    } catch (error) {
      return buildErrorWebhookResponse(
        'Failed to get SocialBu accounts',
        error instanceof Error ? error : undefined
      );
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
        return buildErrorWebhookResponse('User not found');
      }

      return buildSuccessWebhookResponse(
        `Account ${accountId} removed successfully`,
        {
          socialbu_account_ids: result.socialbu_account_ids || []
        }
      );
    } catch (error) {
      return buildErrorWebhookResponse(
        'Failed to remove SocialBu account',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if user has a specific SocialBu account ID
   */
  async checkUserHasAccount(userId: string, accountId: number): Promise<WebhookResponse> {
    try {
      await connectMongo();

      const user = await User.findById(userId);
      if (!user) {
        return buildErrorWebhookResponse('User not found', 'User not found');
      }

      const hasAccount = userHasAccount(user.socialbu_account_ids, accountId);

      return buildUserAccountCheckResponse(
        userId,
        accountId,
        hasAccount,
        user.socialbu_account_ids || []
      );
    } catch (error) {
      return buildErrorWebhookResponse(
        'Failed to check user account',
        error instanceof Error ? error : undefined
      );
    }
  }
}

export default WebhookService.getInstance();