import User from "../../../database/models/User";
import { connectMongo } from "../../../database/connection";

class WebhookSocialBuService {
  private static instance: WebhookSocialBuService;

  constructor() {}

  static getInstance() {
    if (!WebhookSocialBuService.instance) {
      WebhookSocialBuService.instance = new WebhookSocialBuService();
    }
    return WebhookSocialBuService.instance;
  }

  /**
   * Get user's SocialBu account IDs
   */
  async getUserSocialBuAccounts(userId: string) {
    try {
      await connectMongo();
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }
      return {
        success: true,
        data: {
          socialbu_account_ids: user.socialbu_account_ids || []
        }
      };
    } catch (error) {
      console.error('Error getting user SocialBu accounts:', error);
      return {
        success: false,
        message: 'Failed to get user SocialBu accounts',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default WebhookSocialBuService.getInstance();
