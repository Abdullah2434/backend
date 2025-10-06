import socialBuService from './socialbu.service';
import { SocialBuApiResponse, SocialBuAccount } from '../types';

export class SocialBuAccountService {
  async getUserAccounts(
    token: string
  ): Promise<SocialBuApiResponse<SocialBuAccount[]>> {
    try {
      const authService = new (await import("../services/auth.service")).default();

      const user = await authService.getCurrentUser(token);
      if (!user) {
        return {
          success: false,
          message: "User not found or invalid token",
        };
      }

      // Get all accounts from SocialBu
      const accountsResult = await socialBuService.getAccounts();

      if (!accountsResult.success || !accountsResult.data) {
        return {
          success: false,
          message: accountsResult.message || "Failed to get accounts",
          error: accountsResult.error
        };
      }

      // Filter accounts that belong to this user
      const userAccountIds = user.socialbu_account_ids || [];
      const userAccounts = accountsResult.data.filter((account: any) =>
        userAccountIds.includes(Number(account.id))
      );

      return {
        success: true,
        message: "User accounts retrieved successfully",
        data: userAccounts,
      };
    } catch (error) {
      console.error("Error getting user accounts", error);
      return {
        success: false,
        message: "Failed to retrieve user accounts",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const socialBuAccountService = new SocialBuAccountService();
