import axios, { AxiosResponse, AxiosError } from "axios";
import SocialBuToken, { ISocialBuToken } from "../../models/SocialBuToken";
import { connectMongo } from "../../config/mongoose";
import {
  SOCIALBU_API_BASE_URL,
  ACCOUNTS_ENDPOINT,
  POSTS_ENDPOINT,
  DEFAULT_ACCOUNTS_QUERY,
  DEFAULT_POST_TYPE,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  MAX_RETRY_COUNT,
} from "../../constants/socialbuService.constants";
import {
  SocialBuLoginResponse,
  SocialBuApiResponse,
  ConnectAccountRequestBody,
} from "../../types/socialbuService.types";
import {
  getNewTokenFromAPI,
  saveOrUpdateToken,
  isAuthenticationError,
  extractAxiosErrorMessage,
  buildAuthHeaders,
  extractPostsData,
  filterPostsByAccountIds,
  buildEmptyPostsResponse,
  buildFilteredPostsResponse,
  buildConnectAccountBody,
} from "../../utils/socialbuServiceHelpers";

class SocialBuService {
  private static instance: SocialBuService;

  private constructor() {}

  public static getInstance(): SocialBuService {
    if (!SocialBuService.instance) {
      SocialBuService.instance = new SocialBuService();
    }
    return SocialBuService.instance;
  }

  /**
   * Get valid token for API calls
   */
  async getValidToken(): Promise<string | null> {
    try {
      await connectMongo();

      // Try to get active token from database
      const activeToken = await SocialBuToken.findActiveToken();

      if (activeToken && !activeToken.isExpired) {
        // Mark as used and return token
        await activeToken.markAsUsed();
        return activeToken.authToken;
      }

      const newToken = await this.getNewToken();

      if (newToken) {
        return newToken.authToken;
      }

      return null;
    } catch (error) {

      return null;
    }
  }

  /**
   * Get new token from SocialBu API
   */
  async getNewToken(): Promise<ISocialBuToken | null> {
    try {
      await connectMongo();

      const tokenData = await getNewTokenFromAPI();
      if (!tokenData) {
        return null;
      }

      return await saveOrUpdateToken(tokenData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Save token manually (for initial setup)
   */
  async saveToken(
    tokenData: SocialBuLoginResponse
  ): Promise<ISocialBuToken | null> {
    return await saveOrUpdateToken(tokenData);
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
      const token = await this.getValidToken();

      if (!token) {
        return {
          success: false,
          message: ERROR_MESSAGES.NO_VALID_TOKEN,
        };
      }

      const url = `${SOCIALBU_API_BASE_URL}${endpoint}`;

      const config = {
        method,
        url,
        headers: buildAuthHeaders(token),
        ...(data && { data }),
      };

      const response: AxiosResponse<T> = await axios(config);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
    

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // If unauthorized and we haven't retried yet, try to get new token
        if (
          isAuthenticationError(
            undefined,
            axiosError.response?.status
          ) &&
          retryCount < MAX_RETRY_COUNT
        ) {
          // Try to get new token
          const newToken = await this.getNewToken();

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

        const { message, error: errorMsg } = extractAxiosErrorMessage(axiosError);
        return {
          success: false,
          message,
          error: errorMsg,
        };
      }

      return {
        success: false,
        message: ERROR_MESSAGES.UNKNOWN_ERROR,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
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
      const requestBody = buildConnectAccountBody(provider, postbackUrl, accountId);

      const result = await this.makeAuthenticatedRequest(
        "POST",
        ACCOUNTS_ENDPOINT,
        requestBody
      );

      if (result.success) {
        return result;
      }

      // If failed due to authentication, try to refresh token and retry
      if (isAuthenticationError(result.message)) {
        const newToken = await this.getNewToken();

        if (newToken) {
          return this.makeAuthenticatedRequest(
            "POST",
            ACCOUNTS_ENDPOINT,
            requestBody
          );
        }
      }

      return result;
    } catch (error) {
      // Try one more time with fresh token
      try {
        const newToken = await this.getNewToken();

        if (newToken) {
          const requestBody = buildConnectAccountBody(provider, postbackUrl, accountId);
          return this.makeAuthenticatedRequest(
            "POST",
            ACCOUNTS_ENDPOINT,
            requestBody
          );
        }
      } catch (retryError) {
        // Silently fail retry
      }

      return {
        success: false,
        message: ERROR_MESSAGES.FAILED_TO_CONNECT_ACCOUNT,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Get accounts from SocialBu with seamless token refresh
   */
  async getAccounts(): Promise<SocialBuApiResponse> {
    try {
      // First attempt with current token
      const result = await this.makeAuthenticatedRequest(
        "GET",
        `${ACCOUNTS_ENDPOINT}?${DEFAULT_ACCOUNTS_QUERY}`
      );

      // If successful, return the result
      if (result.success) {
        return result;
      }

      // If failed due to authentication, try to refresh token and retry
      if (isAuthenticationError(result.message)) {
        const newToken = await this.getNewToken();

        if (newToken) {
          return this.makeAuthenticatedRequest(
            "GET",
            `${ACCOUNTS_ENDPOINT}?${DEFAULT_ACCOUNTS_QUERY}`
          );
        }
      }

      // If all else fails, return the original error
      return result;
    } catch (error) {
      // Try one more time with fresh token
      try {
        const newToken = await this.getNewToken();

        if (newToken) {
          return this.makeAuthenticatedRequest(
            "GET",
            `${ACCOUNTS_ENDPOINT}?${DEFAULT_ACCOUNTS_QUERY}`
          );
        }
      } catch (retryError) {
        // Silently fail retry
      }

      return {
        success: false,
        message: ERROR_MESSAGES.FAILED_TO_RETRIEVE_ACCOUNTS,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Get scheduled posts from SocialBu API
   */
  async getScheduledPosts(
    userAccountIds?: number[]
  ): Promise<SocialBuApiResponse> {
    try {
      const result = await this.makeAuthenticatedRequest("GET", POSTS_ENDPOINT, {
        type: DEFAULT_POST_TYPE,
      });

      if (result.success) {
        // If user account IDs are provided (even if empty array), filter the posts
        if (userAccountIds !== undefined && userAccountIds !== null) {
          // If user has no connected accounts, return empty results
          if (userAccountIds.length === 0) {
            return {
              success: true,
              data: buildEmptyPostsResponse(result.data?.total || 0),
              message: SUCCESS_MESSAGES.NO_SCHEDULED_POSTS,
            };
          }

          // Extract posts data from API response
          const allPosts = extractPostsData(result.data);

          // Filter posts that match user's connected account IDs
          const filteredPosts = filterPostsByAccountIds(allPosts, userAccountIds);

          return {
            success: true,
            data: buildFilteredPostsResponse(filteredPosts, result.data),
            message: `Found ${filteredPosts.length} scheduled posts for user's connected accounts`,
          };
        }

        return result;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: ERROR_MESSAGES.FAILED_TO_FETCH_POSTS,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  /**
   * Manual login to SocialBu (for testing)
   */
  async manualLogin(): Promise<SocialBuApiResponse> {
    try {
      const newToken = await this.getNewToken();

      if (newToken) {
        return {
          success: true,
          message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
          data: {
            id: newToken.id,
            name: newToken.name,
            email: newToken.email,
            verified: newToken.verified,
            lastUsed: newToken.lastUsed,
          },
        };
      } else {
        return {
          success: false,
          message: ERROR_MESSAGES.FAILED_TO_LOGIN,
        };
      }
    } catch (error) {
      return {
        success: false,
        message:
          "Error during login: " +
          (error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR),
      };
    }
  }
}

export default SocialBuService.getInstance();
