import { Request, Response } from "express";
import User from "../../../models/User";
import { connectMongo } from "../../../config/mongoose";
import { logger } from "../../../core/utils/logger";
import { SocialBuWebhookData, WebhookResponse } from "../types/socialbu.types";

/**
 * SocialBu Account Webhook Handler
 * Handles incoming webhook events from SocialBu for account changes
 */
class SocialBuAccountWebhookHandler {
  private static instance: SocialBuAccountWebhookHandler;

  private constructor() {}

  public static getInstance(): SocialBuAccountWebhookHandler {
    if (!SocialBuAccountWebhookHandler.instance) {
      SocialBuAccountWebhookHandler.instance =
        new SocialBuAccountWebhookHandler();
    }
    return SocialBuAccountWebhookHandler.instance;
  }

  /**
   * Handle SocialBu account webhook
   */
  async handleAccountWebhook(
    webhookData: SocialBuWebhookData,
    userId?: string
  ): Promise<WebhookResponse> {
    try {
      await connectMongo();

      logger.info("Processing SocialBu webhook:", { webhookData, userId });

      const { account_action, account_id, account_type, account_name } =
        webhookData;

      if (account_action === "added" || account_action === "updated") {
        // Add account_id to specific user if userId is provided, otherwise add to all users
        const updateQuery = userId ? { _id: userId } : {}; // Update all users if no specific user ID

        const result = await User.updateMany(updateQuery, {
          $addToSet: {
            socialbu_account_ids: account_id,
          },
        });

        logger.info(
          `${
            account_action === "updated" ? "Updated" : "Added"
          } account ${account_id} to ${result.modifiedCount} user(s)`
        );

        return {
          success: true,
          message: `Account ${account_id} (${account_name}) ${
            account_action === "updated" ? "updated" : "added"
          } successfully${userId ? ` to user ${userId}` : " to all users"}`,
          data: {
            account_id,
            account_name,
            account_type,
            users_updated: result.modifiedCount,
            target_user: userId || "all_users",
          },
        };
      } else if (account_action === "removed") {
        // Remove account_id from specific user if userId is provided, otherwise remove from all users
        const updateQuery = userId ? { _id: userId } : {}; // Update all users if no specific user ID

        const result = await User.updateMany(updateQuery, {
          $pull: {
            socialbu_account_ids: account_id,
          },
        });

        logger.info(
          `Removed account ${account_id} from ${result.modifiedCount} user(s)`
        );

        return {
          success: true,
          message: `Account ${account_id} (${account_name}) removed successfully${
            userId ? ` from user ${userId}` : " from all users"
          }`,
          data: {
            account_id,
            account_name,
            account_type,
            users_updated: result.modifiedCount,
            target_user: userId || "all_users",
          },
        };
      } else {
        return {
          success: false,
          message: `Unknown account action: ${account_action}`,
        };
      }
    } catch (error) {
      logger.error("Error processing SocialBu webhook", error);
      return {
        success: false,
        message: "Failed to process webhook",
        data: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Handle webhook HTTP request
   */
  async handleWebhookRequest(req: Request, res: Response): Promise<void> {
    try {
      const webhookData: SocialBuWebhookData = req.body;
      const userId = req.query.user_id as string | undefined;

      logger.info("Received SocialBu webhook:", { webhookData, userId });

      const result = await this.handleAccountWebhook(webhookData, userId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Error handling webhook request", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get user's SocialBu account IDs
   */
  async getUserAccounts(userId: string): Promise<WebhookResponse> {
    try {
      await connectMongo();

      const user = await User.findById(userId).select("socialbu_account_ids");

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      return {
        success: true,
        message: "SocialBu accounts retrieved successfully",
        data: {
          socialbu_account_ids: user.socialbu_account_ids || [],
        },
      };
    } catch (error) {
      logger.error("Error getting user SocialBu accounts", error);
      return {
        success: false,
        message: "Failed to get SocialBu accounts",
        data: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Remove specific SocialBu account from user
   */
  async removeUserAccount(
    userId: string,
    accountId: string
  ): Promise<WebhookResponse> {
    try {
      await connectMongo();

      const result = await User.findByIdAndUpdate(
        userId,
        {
          $pull: {
            socialbu_account_ids: accountId,
          },
        },
        { new: true }
      );

      if (!result) {
        return {
          success: false,
          message: "User not found",
        };
      }

      return {
        success: true,
        message: `Account ${accountId} removed successfully`,
        data: {
          socialbu_account_ids: result.socialbu_account_ids || [],
        },
      };
    } catch (error) {
      logger.error("Error removing SocialBu account", error);
      return {
        success: false,
        message: "Failed to remove SocialBu account",
        data: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if user has a specific SocialBu account ID
   */
  async checkUserHasAccount(
    userId: string,
    accountId: string
  ): Promise<WebhookResponse> {
    try {
      await connectMongo();

      logger.info(`Checking if user ${userId} has account ${accountId}`);

      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      const hasAccount =
        user.socialbu_account_ids &&
        user.socialbu_account_ids.includes(accountId);

      return {
        success: true,
        message: hasAccount
          ? "User has this account"
          : "User does not have this account",
        data: {
          userId,
          accountId,
          hasAccount,
          userAccounts: user.socialbu_account_ids || [],
        },
      };
    } catch (error) {
      logger.error("Error checking user account", error);
      return {
        success: false,
        message: "Failed to check user account",
        data: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const socialBuWebhookHandler =
  SocialBuAccountWebhookHandler.getInstance();
