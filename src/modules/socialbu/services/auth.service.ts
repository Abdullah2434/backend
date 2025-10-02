import axios from "axios";
import SocialBuToken, { ISocialBuToken } from "../../../models/SocialBuToken";
import { connectMongo } from "../../../config/mongoose";
import { logger } from "../../../core/utils/logger";
import {
  SocialBuLoginRequest,
  SocialBuLoginResponse,
  SocialBuApiResponse,
} from "../types/socialbu.types";

const SOCIALBU_API_BASE_URL =
  process.env.SOCIALBU_API_URL || "https://socialbu.com/api/v1";
const SOCIALBU_AUTH_URL = `${SOCIALBU_API_BASE_URL}/auth/get_token`;

/**
 * SocialBu Authentication Service
 * Handles token management, login, and authentication
 */
class SocialBuAuthService {
  private static instance: SocialBuAuthService;

  private constructor() {}

  public static getInstance(): SocialBuAuthService {
    if (!SocialBuAuthService.instance) {
      SocialBuAuthService.instance = new SocialBuAuthService();
    }
    return SocialBuAuthService.instance;
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

      // If no valid token, try to get new one
      logger.info("No valid token found, attempting to get new token...");
      const newToken = await this.getNewToken();

      if (newToken) {
        return newToken.authToken;
      }

      return null;
    } catch (error) {
      logger.error("Error getting valid token", error);
      return null;
    }
  }

  /**
   * Get new token from SocialBu API
   */
  async getNewToken(): Promise<ISocialBuToken | null> {
    try {
      await connectMongo();

      const email = process.env.SOCIALBU_EMAIL;
      const password = process.env.SOCIALBU_PASSWORD;

      if (!email || !password) {
        logger.error("SocialBu credentials not found in environment variables");
        return null;
      }

      logger.info("Calling SocialBu API to get new token...");

      const response = await axios.post<SocialBuLoginResponse["data"]>(
        SOCIALBU_AUTH_URL,
        {
          email,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (response.data && response.data.authToken) {
        logger.info("Successfully got new token from SocialBu");

        // Find existing active token to update
        const existingToken = await SocialBuToken.findOne({ isActive: true });

        if (existingToken) {
          // Update existing token instead of creating new one
          logger.info("Updating existing token instead of creating new one");
          existingToken.authToken = response.data.authToken;
          existingToken.id = response.data.id;
          existingToken.name = response.data.name;
          existingToken.email = response.data.email;
          existingToken.verified = response.data.verified;
          existingToken.isActive = true;
          existingToken.lastUsed = new Date();

          await existingToken.save();
          return existingToken;
        }

        // Create new token
        const newToken = new SocialBuToken({
          authToken: response.data.authToken,
          id: response.data.id,
          name: response.data.name,
          email: response.data.email,
          verified: response.data.verified,
          isActive: true,
          lastUsed: new Date(),
        });

        await newToken.save();
        logger.info("New token saved to database");

        return newToken;
      }

      return null;
    } catch (error: any) {
      logger.error("Error getting new token from SocialBu API", error);
      if (error.response) {
        logger.error(
          `API response error: ${error.response.status} - ${JSON.stringify(
            error.response.data
          )}`
        );
      }
      return null;
    }
  }

  /**
   * Manual login to SocialBu (for admin/setup purposes)
   */
  async manualLogin(): Promise<SocialBuLoginResponse> {
    try {
      const token = await this.getNewToken();

      if (token) {
        return {
          success: true,
          message: "Successfully logged in to SocialBu and saved token",
          data: {
            authToken: token.authToken,
            id: token.id,
            name: token.name,
            email: token.email,
            verified: token.verified,
          },
        };
      }

      return {
        success: false,
        message: "Failed to login to SocialBu. Check credentials.",
      };
    } catch (error: any) {
      logger.error("Error in manual login", error);
      return {
        success: false,
        message: error.message || "Failed to login to SocialBu",
      };
    }
  }

  /**
   * Save token manually (for initial setup)
   */
  async saveToken(tokenData: {
    authToken: string;
    id: number;
    name: string;
    email: string;
    verified: boolean;
  }): Promise<SocialBuApiResponse> {
    try {
      await connectMongo();

      // Deactivate all existing tokens
      await SocialBuToken.deactivateAllTokens();

      // Create new token
      const newToken = new SocialBuToken({
        ...tokenData,
        isActive: true,
        lastUsed: new Date(),
      });

      await newToken.save();

      logger.info("Token saved successfully");

      return {
        success: true,
        message: "Token saved successfully",
        data: {
          id: newToken.id,
          email: newToken.email,
          name: newToken.name,
        },
      };
    } catch (error: any) {
      logger.error("Error saving token", error);
      return {
        success: false,
        message: "Failed to save token",
        error: error.message,
      };
    }
  }

  /**
   * Test authentication with current token
   */
  async testAuth(): Promise<SocialBuApiResponse> {
    try {
      const token = await this.getValidToken();

      if (!token) {
        return {
          success: false,
          message: "No valid token available",
        };
      }

      return {
        success: true,
        message: "Authentication successful",
        data: { hasToken: true },
      };
    } catch (error: any) {
      logger.error("Error testing authentication", error);
      return {
        success: false,
        message: "Authentication test failed",
        error: error.message,
      };
    }
  }
}

export const socialBuAuthService = SocialBuAuthService.getInstance();
