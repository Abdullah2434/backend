import * as bcrypt from "bcryptjs";
import User from "../../../models/User";
import { sendPasswordResetEmail } from "../../../modules/email";
import {
  ResetPasswordData,
  AuthConfig,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "../types/auth.types";
import AuthTokenService from "./auth-token.service";

export class AuthPasswordService {
  private readonly tokenService: AuthTokenService;
  private readonly config: AuthConfig;

  constructor() {
    this.tokenService = new AuthTokenService();
    this.config = this.tokenService.getConfig();
  }

  // ==================== PASSWORD RESET ====================

  async forgotPassword(email: string): Promise<{ message: string }> {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if user exists or not for security
        return {
          message:
            "If an account with that email exists, a password reset link has been sent.",
        };
      }

      // Generate reset token
      const resetToken = this.tokenService.generateResetToken(
        user._id.toString(),
        user.email
      );

      // Save reset token to user
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = new Date(
        Date.now() + this.config.passwordResetExpiry
      );
      await user.save();

      // Send password reset email
      await sendPasswordResetEmail(user.email, resetToken, user.firstName);

      return {
        message:
          "If an account with that email exists, a password reset link has been sent.",
      };
    } catch (error) {
      throw new AuthenticationError("Password reset request failed", 500);
    }
  }

  async resetPassword(
    resetData: ResetPasswordData
  ): Promise<{ message: string }> {
    try {
      const { resetToken, newPassword } = resetData;

      // Verify reset token
      const payload = this.tokenService.verifyToken(resetToken);
      if (!payload || payload.type !== "reset") {
        throw new ValidationError("Invalid or expired reset token");
      }

      // Find user by reset token
      const user = await User.findOne({
        passwordResetToken: resetToken,
        passwordResetExpires: { $gt: new Date() },
      });

      if (!user) {
        throw new ValidationError("Invalid or expired reset token");
      }

      // Update password
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      return {
        message:
          "Password has been reset successfully. You can now log in with your new password.",
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AuthenticationError("Password reset failed", 500);
    }
  }

  async validateResetToken(
    token: string
  ): Promise<{ isValid: boolean; message: string }> {
    try {
      const payload = this.tokenService.verifyToken(token);
      if (!payload || payload.type !== "reset") {
        return {
          isValid: false,
          message: "Invalid or expired reset token",
        };
      }

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      });

      if (!user) {
        return {
          isValid: false,
          message: "Invalid or expired reset token",
        };
      }

      return {
        isValid: true,
        message: "Reset token is valid",
      };
    } catch (error) {
      return {
        isValid: false,
        message: "Invalid or expired reset token",
      };
    }
  }

  // ==================== PASSWORD UTILITIES ====================

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    try {
      const user = await User.findById(userId).select("+password");
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Verify current password
      const isCurrentPasswordValid = await this.comparePassword(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        throw new ValidationError("Current password is incorrect");
      }

      // Update password
      user.password = newPassword;
      await user.save();

      return {
        message: "Password has been changed successfully",
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new AuthenticationError("Password change failed", 500);
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

export default AuthPasswordService;
