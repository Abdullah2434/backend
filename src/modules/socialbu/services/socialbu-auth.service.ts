import axios from "axios";
import SocialBuToken from "../../../database/models/SocialBuToken";
import {
  SocialBuAuthData,
  SocialBuLoginRequest,
  SocialBuLoginResponse,
  SocialBuTokenData,
  SocialBuConfig,
  SocialBuApiResponse,
  AuthenticationError,
  ApiError,
} from "../types/socialbu.types";
import {
  logSocialBuEvent,
  logSocialBuError,
  logSocialBuApiCall,
  getSocialBuConfig,
  maskAuthToken,
} from "../utils/socialbu.utils";

export class SocialBuAuthService {
  private readonly config: SocialBuConfig;

  constructor() {
    this.config = {
      apiUrl: process.env.SOCIALBU_API_URL || "https://api.socialbu.com",
      apiKey: process.env.SOCIALBU_API_KEY || "",
      webhookSecret: process.env.SOCIALBU_WEBHOOK_SECRET || "",
      timeout: parseInt(process.env.SOCIALBU_TIMEOUT || "30000"),
      retryAttempts: parseInt(process.env.SOCIALBU_RETRY_ATTEMPTS || "3"),
      retryDelay: parseInt(process.env.SOCIALBU_RETRY_DELAY || "1000"),
      enableLogging: process.env.SOCIALBU_ENABLE_LOGGING === "true",
      enableWebhooks: process.env.SOCIALBU_ENABLE_WEBHOOKS === "true",
      rateLimitWindow: parseInt(
        process.env.SOCIALBU_RATE_LIMIT_WINDOW || "60000"
      ),
      rateLimitMax: parseInt(process.env.SOCIALBU_RATE_LIMIT_MAX || "100"),
    };

    if (!this.config.apiKey) {
      throw new Error("SOCIALBU_API_KEY environment variable is required");
    }
  }

  // ==================== AUTHENTICATION ====================

  async manualLogin(): Promise<SocialBuLoginResponse> {
    try {
      const email = process.env.SOCIALBU_EMAIL;
      const password = process.env.SOCIALBU_PASSWORD;

      if (!email || !password) {
        throw new AuthenticationError("SocialBu credentials not configured");
      }

      logSocialBuApiCall("/auth/login", "POST", {
        email: email.substring(0, 3) + "***",
      });

      const response = await axios.post(
        `${this.config.apiUrl}/auth/login`,
        { email, password },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.config.apiKey,
          },
          timeout: this.config.timeout,
        }
      );

      if (response.data.success) {
        const authData = response.data.data;

        // Save token to database
        await this.saveToken(authData);

        logSocialBuEvent("manual_login_success", {
          userId: authData.id,
          email: email.substring(0, 3) + "***",
        });

        return {
          success: true,
          message: "Successfully logged in to SocialBu",
          data: {
            authToken: authData.authToken,
            user: {
              id: authData.id,
              name: authData.name,
              email: authData.email,
              verified: authData.verified,
            },
          },
        };
      } else {
        throw new AuthenticationError(response.data.message || "Login failed");
      }
    } catch (error) {
      logSocialBuError(error as Error, { action: "manualLogin" });

      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new ApiError("Failed to login to SocialBu");
    }
  }

  async saveToken(authData: SocialBuAuthData): Promise<SocialBuTokenData> {
    try {
      // Check if token already exists
      let token = await SocialBuToken.findOne({ id: authData.id });

      if (token) {
        // Update existing token
        token.authToken = authData.authToken;
        token.name = authData.name;
        token.email = authData.email;
        token.verified = authData.verified;
        token.isActive = true;
        token.lastUsed = new Date();
        await token.save();
      } else {
        // Create new token
        token = new SocialBuToken({
          authToken: authData.authToken,
          id: parseInt(authData.id),
          name: authData.name,
          email: authData.email,
          verified: authData.verified,
          isActive: true,
          lastUsed: new Date(),
        });
        await token.save();
      }

      logSocialBuEvent("token_saved", {
        userId: authData.id,
        tokenMasked: maskAuthToken(authData.authToken),
      });

      return {
        _id: (token._id as any).toString(),
        authToken: token.authToken,
        userId: authData.id,
        user: {
          id: authData.id,
          name: authData.name,
          email: authData.email,
          verified: authData.verified,
        },
        isExpired: !token.isActive,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
      };
    } catch (error) {
      logSocialBuError(error as Error, { action: "saveToken" });
      throw new ApiError("Failed to save SocialBu token");
    }
  }

  async getToken(userId?: string): Promise<SocialBuTokenData | null> {
    try {
      let token;

      if (userId) {
        token = await SocialBuToken.findOne({ id: parseInt(userId) });
      } else {
        token = await SocialBuToken.findOne({ isActive: true }).sort({
          updatedAt: -1,
        });
      }

      if (!token) {
        return null;
      }

      // Check if token is expired (older than 24 hours)
      const tokenAge = Date.now() - token.updatedAt.getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (tokenAge > maxAge) {
        token.isActive = false;
        await token.save();
        return null;
      }

      return {
        _id: (token._id as any).toString(),
        authToken: token.authToken,
        userId: token.id.toString(),
        user: {
          id: token.id.toString(),
          name: token.name,
          email: token.email,
          verified: token.verified,
        },
        isExpired: !token.isActive,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
      };
    } catch (error) {
      logSocialBuError(error as Error, { action: "getToken" });
      throw new ApiError("Failed to retrieve SocialBu token");
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      logSocialBuApiCall("/auth/validate", "POST", {
        token: maskAuthToken(token),
      });

      const response = await axios.post(
        `${this.config.apiUrl}/auth/validate`,
        { token },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.config.apiKey,
          },
          timeout: this.config.timeout,
        }
      );

      return response.data.success === true;
    } catch (error) {
      logSocialBuError(error as Error, { action: "validateToken" });
      return false;
    }
  }

  async refreshToken(): Promise<SocialBuLoginResponse> {
    try {
      const currentToken = await this.getToken();

      if (!currentToken) {
        throw new AuthenticationError("No valid token found");
      }

      logSocialBuApiCall("/auth/refresh", "POST", {
        token: maskAuthToken(currentToken.authToken),
      });

      const response = await axios.post(
        `${this.config.apiUrl}/auth/refresh`,
        { token: currentToken.authToken },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.config.apiKey,
          },
          timeout: this.config.timeout,
        }
      );

      if (response.data.success) {
        const authData = response.data.data;
        await this.saveToken(authData);

        logSocialBuEvent("token_refreshed", {
          userId: authData.id,
          tokenMasked: maskAuthToken(authData.authToken),
        });

        return {
          success: true,
          message: "Token refreshed successfully",
          data: {
            authToken: authData.authToken,
            user: {
              id: authData.id,
              name: authData.name,
              email: authData.email,
              verified: authData.verified,
            },
          },
        };
      } else {
        throw new AuthenticationError(
          response.data.message || "Token refresh failed"
        );
      }
    } catch (error) {
      logSocialBuError(error as Error, { action: "refreshToken" });

      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new ApiError("Failed to refresh SocialBu token");
    }
  }

  async logout(): Promise<void> {
    try {
      const token = await this.getToken();

      if (token) {
        // Mark token as inactive
        await SocialBuToken.findByIdAndUpdate(token._id, { isActive: false });

        logSocialBuEvent("logout_success", {
          userId: token.userId,
          tokenMasked: maskAuthToken(token.authToken),
        });
      }
    } catch (error) {
      logSocialBuError(error as Error, { action: "logout" });
      throw new ApiError("Failed to logout from SocialBu");
    }
  }

  // ==================== UTILITY METHODS ====================

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getToken();
      return token !== null && !token.isExpired;
    } catch (error) {
      return false;
    }
  }

  async getCurrentUser(): Promise<SocialBuTokenData | null> {
    return this.getToken();
  }

  // ==================== CONFIGURATION ====================

  getConfig(): SocialBuConfig {
    return { ...this.config };
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      api: "available" | "unavailable";
      database: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      // Test API connection
      await axios.get(`${this.config.apiUrl}/health`, {
        headers: { "X-API-Key": this.config.apiKey },
        timeout: 5000,
      });

      // Test database connection
      await SocialBuToken.findOne().limit(1);

      return {
        status: "healthy",
        services: {
          api: "available",
          database: "available",
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          api: "unavailable",
          database: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default SocialBuAuthService;
