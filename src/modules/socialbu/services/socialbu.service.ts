import SocialBuAuthService from "./socialbu-auth.service";
import {
  SocialBuConfig,
  SocialBuResponse,
  SocialBuAuthData,
  SocialBuLoginRequest,
  SocialBuLoginResponse,
  SocialBuTokenData,
} from "../types/socialbu.types";
import {
  logSocialBuEvent,
  logSocialBuError,
  getSocialBuConfig,
} from "../utils/socialbu.utils";

export class SocialBuService {
  private readonly authService: SocialBuAuthService;

  constructor() {
    this.authService = new SocialBuAuthService();
  }

  // ==================== AUTHENTICATION ====================

  async manualLogin(): Promise<SocialBuLoginResponse> {
    return this.authService.manualLogin();
  }

  async saveToken(authData: SocialBuAuthData): Promise<SocialBuTokenData> {
    return this.authService.saveToken(authData);
  }

  async getToken(userId?: string): Promise<SocialBuTokenData | null> {
    return this.authService.getToken(userId);
  }

  async validateToken(token: string): Promise<boolean> {
    return this.authService.validateToken(token);
  }

  async refreshToken(): Promise<SocialBuLoginResponse> {
    return this.authService.refreshToken();
  }

  async logout(): Promise<void> {
    return this.authService.logout();
  }

  async isAuthenticated(): Promise<boolean> {
    return this.authService.isAuthenticated();
  }

  async getCurrentUser(): Promise<SocialBuTokenData | null> {
    return this.authService.getCurrentUser();
  }

  // ==================== ACCOUNT MANAGEMENT ====================

  async getAccounts(userId?: string): Promise<SocialBuResponse> {
    try {
      const token = await this.authService.getToken(userId);

      if (!token) {
        return {
          success: false,
          message: "No valid SocialBu token found",
        };
      }

      // This would typically make an API call to get accounts
      // For now, return a placeholder response
      return {
        success: true,
        message: "Accounts retrieved successfully",
        data: {
          accounts: [],
          total: 0,
        },
      };
    } catch (error) {
      logSocialBuError(error as Error, { action: "getAccounts" });
      return {
        success: false,
        message: "Failed to retrieve accounts",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async connectAccount(accountData: any): Promise<SocialBuResponse> {
    try {
      const token = await this.authService.getToken();

      if (!token) {
        return {
          success: false,
          message: "No valid SocialBu token found",
        };
      }

      // This would typically make an API call to connect account
      // For now, return a placeholder response
      return {
        success: true,
        message: "Account connected successfully",
        data: accountData,
      };
    } catch (error) {
      logSocialBuError(error as Error, { action: "connectAccount" });
      return {
        success: false,
        message: "Failed to connect account",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async disconnectAccount(accountId: string): Promise<SocialBuResponse> {
    try {
      const token = await this.authService.getToken();

      if (!token) {
        return {
          success: false,
          message: "No valid SocialBu token found",
        };
      }

      // This would typically make an API call to disconnect account
      // For now, return a placeholder response
      return {
        success: true,
        message: "Account disconnected successfully",
        data: { accountId },
      };
    } catch (error) {
      logSocialBuError(error as Error, { action: "disconnectAccount" });
      return {
        success: false,
        message: "Failed to disconnect account",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==================== MEDIA MANAGEMENT ====================

  async uploadMedia(mediaData: any): Promise<SocialBuResponse> {
    try {
      const token = await this.authService.getToken();

      if (!token) {
        return {
          success: false,
          message: "No valid SocialBu token found",
        };
      }

      // This would typically make an API call to upload media
      // For now, return a placeholder response
      return {
        success: true,
        message: "Media uploaded successfully",
        data: mediaData,
      };
    } catch (error) {
      logSocialBuError(error as Error, { action: "uploadMedia" });
      return {
        success: false,
        message: "Failed to upload media",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getMedia(userId?: string): Promise<SocialBuResponse> {
    try {
      const token = await this.authService.getToken(userId);

      if (!token) {
        return {
          success: false,
          message: "No valid SocialBu token found",
        };
      }

      // This would typically make an API call to get media
      // For now, return a placeholder response
      return {
        success: true,
        message: "Media retrieved successfully",
        data: {
          media: [],
          total: 0,
        },
      };
    } catch (error) {
      logSocialBuError(error as Error, { action: "getMedia" });
      return {
        success: false,
        message: "Failed to retrieve media",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async deleteMedia(mediaId: string): Promise<SocialBuResponse> {
    try {
      const token = await this.authService.getToken();

      if (!token) {
        return {
          success: false,
          message: "No valid SocialBu token found",
        };
      }

      // This would typically make an API call to delete media
      // For now, return a placeholder response
      return {
        success: true,
        message: "Media deleted successfully",
        data: { mediaId },
      };
    } catch (error) {
      logSocialBuError(error as Error, { action: "deleteMedia" });
      return {
        success: false,
        message: "Failed to delete media",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==================== WEBHOOK MANAGEMENT ====================

  async handleWebhook(webhookData: any): Promise<SocialBuResponse> {
    try {
      logSocialBuEvent("webhook_received", {
        eventType: webhookData.event_type,
        accountId: webhookData.account_id,
        userId: webhookData.user_id,
      });

      // This would typically process the webhook data
      // For now, return a placeholder response
      return {
        success: true,
        message: "Webhook processed successfully",
        data: webhookData,
      };
    } catch (error) {
      logSocialBuError(error as Error, { action: "handleWebhook" });
      return {
        success: false,
        message: "Failed to process webhook",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==================== CONFIGURATION ====================

  getConfig(): SocialBuConfig {
    return this.authService.getConfig();
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      auth: any;
    };
    timestamp: string;
  }> {
    try {
      const authHealth = await this.authService.healthCheck();

      const overallStatus =
        authHealth.status === "healthy" ? "healthy" : "unhealthy";

      return {
        status: overallStatus,
        services: {
          auth: authHealth,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          auth: { status: "unhealthy" },
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default SocialBuService;
