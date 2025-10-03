import axios, { AxiosResponse, AxiosError } from "axios";
import User from "../../../models/User";
import { socialBuAuthService } from "./auth.service";
import { logger } from "../../../core/utils/logger";
import { SocialBuApiResponse, SocialBuAccount } from "../types/socialbu.types";

const SOCIALBU_API_BASE_URL =
  process.env.SOCIALBU_API_URL || "https://socialbu.com/api/v1";

/**
 * SocialBu Account Management Service
 * Handles account connections, listing, and management
 */
class SocialBuAccountService {
  private static instance: SocialBuAccountService;

  private constructor() {}

  public static getInstance(): SocialBuAccountService {
    if (!SocialBuAccountService.instance) {
      SocialBuAccountService.instance = new SocialBuAccountService();
    }
    return SocialBuAccountService.instance;
  }

  /**
   * Make authenticated request to SocialBu API
   */
  async makeAuthenticatedRequest<T = any>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    data?: any,
    retryCount: number = 0
  ): Promise<SocialBuApiResponse<T>> {
    try {
      const token = await socialBuAuthService.getValidToken();

      if (!token) {
        return {
          success: false,
          message: "No valid token available",
        };
      }

      const url = `${SOCIALBU_API_BASE_URL}${endpoint}`;

      const config = {
        method,
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        ...(data && { data }),
      };

      logger.info(`Making ${method} request to: ${url}`);

      const response: AxiosResponse<T> = await axios(config);

      return {
        success: true,
        message: "Request successful",
        data: response.data,
      };
    } catch (error) {
      logger.error(`Error making authenticated request to ${endpoint}`, error);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // If unauthorized and we haven't retried yet, try to get new token
        if (
          (axiosError.response?.status === 401 ||
            axiosError.response?.status === 403) &&
          retryCount === 0
        ) {
          logger.info(
            "Token appears to be invalid, attempting to get new token..."
          );

          // Try to get new token
          const newToken = await socialBuAuthService.getNewToken();

          if (newToken) {
            // Retry the request with new token
            return this.makeAuthenticatedRequest(
              method,
              endpoint,
              data,
              retryCount + 1
            );
          }
        }

        return {
          success: false,
          message:
            (axiosError.response?.data as any)?.message || axiosError.message,
          error:
            (axiosError.response?.data as any)?.message ||
            (axiosError.response?.data as any)?.error ||
            (axiosError.response?.data as string) ||
            "Unknown error",
        };
      }

      return {
        success: false,
        message: "Unknown error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get accounts from SocialBu with seamless token refresh
   */
  async getAccounts(): Promise<SocialBuApiResponse<SocialBuAccount[]>> {
    try {
      // First attempt with current token
      const result = await this.makeAuthenticatedRequest<SocialBuAccount[]>(
        "GET",
        "/accounts?type=all&type=all"
      );

      // If successful, return the result
      if (result.success) {
        return result;
      }

      // If failed due to authentication, try to refresh token and retry
      if (
        result.message &&
        (result.message.includes("401") ||
          result.message.includes("403") ||
          result.message.includes("Unauthenticated"))
      ) {
        logger.info(
          "Token appears to be invalid, attempting automatic refresh..."
        );

        // Try to get a new token
        const newToken = await socialBuAuthService.getNewToken();

        if (newToken) {
          logger.info("New token obtained, retrying accounts request...");
          // Retry the request with new token
          return this.makeAuthenticatedRequest<SocialBuAccount[]>(
            "GET",
            "/accounts?type=all&type=all"
          );
        }
      }

      // If all else fails, return the original error
      return result;
    } catch (error) {
      logger.error("Error in getAccounts", error);

      // Try one more time with fresh token
      try {
        logger.info("Attempting final retry with fresh token...");
        const newToken = await socialBuAuthService.getNewToken();

        if (newToken) {
          return this.makeAuthenticatedRequest<SocialBuAccount[]>(
            "GET",
            "/accounts?type=all&type=all"
          );
        }
      } catch (retryError) {
        logger.error("Final retry failed", retryError);
      }

      return {
        success: false,
        message: "Failed to retrieve accounts after multiple attempts",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get accounts for a specific user using token
   */
  async getUserAccounts(
    token: string
  ): Promise<SocialBuApiResponse<SocialBuAccount[]>> {
    try {
      const { authService } = await import("../../auth/services/auth.service");

      const user = await authService.getCurrentUser(token);
      if (!user) {
        return {
          success: false,
          message: "User not found or invalid token",
        };
      }

      // Get all accounts from SocialBu
      const accountsResult = await this.getAccounts();

      if (!accountsResult.success || !accountsResult.data) {
        return accountsResult;
      }

      // Filter accounts that belong to this user
      const userAccountIds = user.socialbu_account_ids || [];
      const userAccounts = accountsResult.data.filter((account) =>
        userAccountIds.includes(Number(account.id))
      );

      return {
        success: true,
        message: "User accounts retrieved successfully",
        data: userAccounts,
      };
    } catch (error) {
      logger.error("Error getting user accounts", error);
      return {
        success: false,
        message: "Failed to retrieve user accounts",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Connect new social media account to SocialBu
   */
  async connectAccount(
    provider: string,
    postbackUrl?: string,
    accountId?: string
  ): Promise<SocialBuApiResponse> {
    try {
      const requestBody: any = {
        provider,
      };

      if (postbackUrl) {
        requestBody.postback_url = postbackUrl;
      }

      if (accountId) {
        requestBody.account_id = accountId;
      }

      logger.info("Connecting new account to SocialBu:", requestBody);

      const result = await this.makeAuthenticatedRequest(
        "POST",
        "/accounts",
        requestBody
      );

      if (result.success) {
        logger.info("Account connected successfully");
        return result;
      }

      // If failed due to authentication, try to refresh token and retry
      if (
        result.message &&
        (result.message.includes("401") ||
          result.message.includes("403") ||
          result.message.includes("Unauthenticated"))
      ) {
        logger.info(
          "Token appears to be invalid, attempting automatic refresh..."
        );

        // Try to get a new token
        const newToken = await socialBuAuthService.getNewToken();

        if (newToken) {
          logger.info("New token obtained, retrying account connection...");
          // Retry the request with new token
          return this.makeAuthenticatedRequest(
            "POST",
            "/accounts",
            requestBody
          );
        }
      }

      return result;
    } catch (error) {
      logger.error("Error connecting account", error);

      // Try one more time with fresh token
      try {
        logger.info("Attempting final retry with fresh token...");
        const newToken = await socialBuAuthService.getNewToken();

        if (newToken) {
          const requestBody: any = { provider };
          if (postbackUrl) requestBody.postback_url = postbackUrl;
          if (accountId) requestBody.account_id = accountId;

          return this.makeAuthenticatedRequest(
            "POST",
            "/accounts",
            requestBody
          );
        }
      } catch (retryError) {
        logger.error("Final retry failed", retryError);
      }

      return {
        success: false,
        message: "Failed to connect account after multiple attempts",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Test SocialBu API connection
   */
  async testConnection(): Promise<SocialBuApiResponse> {
    try {
      const result = await this.getAccounts();

      if (result.success) {
        return {
          success: true,
          message: "Connection to SocialBu API successful",
          data: {
            accountCount: result.data?.length || 0,
          },
        };
      }

      return result;
    } catch (error) {
      logger.error("Error testing connection", error);
      return {
        success: false,
        message: "Failed to test connection",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const socialBuAccountService = SocialBuAccountService.getInstance();
