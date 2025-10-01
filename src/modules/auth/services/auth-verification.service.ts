import User from "../../../models/User";
import {
  sendResendVerificationEmail,
  sendWelcomeEmail,
} from "../../../modules/email";
import {
  AuthConfig,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "../types/auth.types";
import AuthTokenService from "./auth-token.service";

export class AuthVerificationService {
  private readonly tokenService: AuthTokenService;
  private readonly config: AuthConfig;

  constructor() {
    this.tokenService = new AuthTokenService();
    this.config = this.tokenService.getConfig();
  }

  // ==================== EMAIL VERIFICATION ====================

  async verifyEmail(token: string): Promise<{ message: string; user: any }> {
    try {
      // Find user by verification token
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() },
      });

      if (!user) {
        throw new ValidationError("Invalid or expired verification token");
      }

      // Mark email as verified
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      // Send welcome email
      await sendWelcomeEmail(user.email, user.firstName);

      return {
        message: "Email has been verified successfully. Welcome!",
        user: user.toObject(),
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AuthenticationError("Email verification failed", 500);
    }
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if user exists or not for security
        return {
          message:
            "If an account with that email exists and is not verified, a verification email has been sent.",
        };
      }

      // Check if email is already verified
      if (user.isEmailVerified) {
        return {
          message: "Email is already verified. You can log in normally.",
        };
      }

      // Generate new verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      await sendResendVerificationEmail(
        user.email,
        verificationToken,
        user.firstName
      );

      return {
        message:
          "If an account with that email exists and is not verified, a verification email has been sent.",
      };
    } catch (error) {
      throw new AuthenticationError("Failed to resend verification email", 500);
    }
  }

  async validateToken(token: string): Promise<{
    isValid: boolean;
    user?: any;
    tokenType?: "access" | "reset";
  }> {
    try {
      const payload = this.tokenService.verifyToken(token);
      if (!payload) {
        return { isValid: false };
      }

      // Determine token type
      const tokenType = (payload as any).type === "reset" ? "reset" : "access";

      // Get user for access tokens
      let user = null;
      if (tokenType === "access") {
        user = await User.findById(payload.userId);
        if (!user) {
          return { isValid: false };
        }
      }

      return {
        isValid: true,
        user: user ? user.toObject() : undefined,
        tokenType,
      };
    } catch (error) {
      return { isValid: false };
    }
  }

  // ==================== VERIFICATION UTILITIES ====================

  async checkEmailVerification(email: string): Promise<{
    exists: boolean;
    isVerified: boolean;
  }> {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return { exists: false, isVerified: false };
      }

      return {
        exists: true,
        isVerified: user.isEmailVerified,
      };
    } catch (error) {
      return { exists: false, isVerified: false };
    }
  }

  async checkEmail(email: string): Promise<{ exists: boolean }> {
    try {
      const user = await User.findOne({ email });
      return { exists: !!user };
    } catch (error) {
      return { exists: false };
    }
  }

  async clearExpiredTokens(): Promise<{
    message: string;
    clearedCount: number;
  }> {
    try {
      const now = new Date();

      // Clear expired email verification tokens
      const emailResult = await User.updateMany(
        {
          emailVerificationExpires: { $lt: now },
          emailVerificationToken: { $exists: true },
        },
        {
          $unset: {
            emailVerificationToken: 1,
            emailVerificationExpires: 1,
          },
        }
      );

      // Clear expired password reset tokens
      const passwordResult = await User.updateMany(
        {
          passwordResetExpires: { $lt: now },
          passwordResetToken: { $exists: true },
        },
        {
          $unset: {
            passwordResetToken: 1,
            passwordResetExpires: 1,
          },
        }
      );

      const totalCleared =
        emailResult.modifiedCount + passwordResult.modifiedCount;

      return {
        message: `Cleared ${totalCleared} expired tokens`,
        clearedCount: totalCleared,
      };
    } catch (error) {
      throw new AuthenticationError("Failed to clear expired tokens", 500);
    }
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      tokenService: "available" | "unavailable";
      email: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      const tokenHealth = await this.tokenService.healthCheck();

      return {
        status: tokenHealth.status === "healthy" ? "healthy" : "unhealthy",
        services: {
          tokenService: tokenHealth.services.jwt,
          email: "available", // Email service health would be checked here
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          tokenService: "unavailable",
          email: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default AuthVerificationService;
