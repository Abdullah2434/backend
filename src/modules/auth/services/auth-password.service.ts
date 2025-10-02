import * as bcrypt from "bcryptjs";
import User from "../../../database/models/User";
import { sendPasswordResetEmail } from "../../../modules/shared/email";
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
      console.log("🔍 Forgot password request:", { email });

      const user = await User.findOne({ email });
      console.log("🔍 User found for forgot password:", {
        userId: user?._id,
        email: user?.email,
        hasExistingResetToken: !!user?.resetPasswordToken,
      });

      if (!user) {
        console.log("❌ User not found for forgot password");
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
      console.log("🔍 Generated reset token:", {
        token: resetToken.substring(0, 20) + "...",
        tokenLength: resetToken.length,
      });

      // Save reset token to user
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = new Date(
        Date.now() + this.config.passwordResetExpiry
      );

      console.log("🔍 Saving reset token to user:", {
        userId: user._id,
        resetTokenLength: user.resetPasswordToken.length,
        resetTokenExpires: user.resetPasswordExpires,
      });

      await user.save();
      console.log("✅ Reset token saved successfully");

      // Send password reset email
      await sendPasswordResetEmail(user.email, resetToken, user.firstName);
      console.log("✅ Password reset email sent");

      return {
        message:
          "If an account with that email exists, a password reset link has been sent.",
      };
    } catch (error) {
      console.log("❌ Forgot password error:", error);
      throw new AuthenticationError("Password reset request failed", 500);
    }
  }

  async resetPassword(
    resetData: ResetPasswordData
  ): Promise<{ message: string }> {
    try {
      const { resetToken, newPassword } = resetData;
      console.log("🔍 Password reset attempt:", {
        resetToken: resetToken?.substring(0, 20) + "...",
        hasNewPassword: !!newPassword,
      });

      // Verify reset token
      const payload = this.tokenService.verifyToken(resetToken);
      console.log("🔍 Token payload:", {
        userId: payload?.userId,
        email: payload?.email,
        type: payload?.type,
      });

      if (!payload || payload.type !== "reset") {
        console.log("❌ Invalid token payload");
        throw new ValidationError("Invalid or expired reset token");
      }

      // Find user by ID from token payload
      const user = await User.findById(payload.userId);
      console.log("🔍 User found:", {
        userId: user?._id,
        email: user?.email,
        hasResetToken: !!user?.resetPasswordToken,
        resetTokenExpires: user?.resetPasswordExpires,
        // Debug: Check if there are any old field names still in use
        hasOldPasswordResetToken: !!(user as any)?.passwordResetToken,
        hasOldPasswordResetExpires: !!(user as any)?.passwordResetExpires,
      });

      if (!user) {
        console.log("❌ User not found");
        throw new ValidationError("Invalid or expired reset token");
      }

      // Check if the stored reset token matches and is not expired
      if (
        !user.resetPasswordToken ||
        user.resetPasswordToken !== resetToken ||
        !user.resetPasswordExpires ||
        user.resetPasswordExpires < new Date()
      ) {
        console.log("❌ Reset token mismatch or expired");
        console.log(
          "💡 This might be an old token. User should request a new forgot password email."
        );
        throw new ValidationError(
          "Invalid or expired reset token. Please request a new password reset email."
        );
      }

      // Update password
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      console.log("✅ Password updated successfully");

      return {
        message:
          "Password has been reset successfully. You can now log in with your new password.",
      };
    } catch (error) {
      console.log("❌ Password reset error:", error);
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
