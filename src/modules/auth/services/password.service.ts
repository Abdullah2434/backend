import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../../../models/User";
import { tokenService } from "./token.service";
import { sendPasswordResetEmail } from "../../../services/email";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../core/errors";
import { ResetPasswordData } from "../types/auth.types";

export class PasswordService {
  /**
   * Hash a password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        message:
          "If an account with that email exists, a password reset link has been sent",
      };
    }

    // Generate JWT reset token with short expiration (15 minutes)
    const resetToken = tokenService.generateResetToken(
      user._id.toString(),
      user.email
    );

    // Send password reset email
    await sendPasswordResetEmail(user.email, resetToken, user.firstName);

    return {
      message:
        "If an account with that email exists, a password reset link has been sent",
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    resetData: ResetPasswordData
  ): Promise<{ message: string }> {
    // Verify JWT reset token
    const payload = tokenService.verifyToken(resetData.resetToken);

    if (!payload) {
      throw new ValidationError("Invalid or expired reset token");
    }

    // Check if it's a reset token
    if (payload.type !== "reset") {
      throw new ValidationError("Invalid token type");
    }

    // Find user by ID from token
    const user = await User.findById(payload.userId).select(
      "+password +lastUsedResetToken"
    );

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Check if this token has already been used
    if (user.lastUsedResetToken === resetData.resetToken) {
      throw new ConflictError("Reset token has already been used");
    }

    // Set new password (will be hashed by model middleware)
    user.password = resetData.newPassword;
    user.lastUsedResetToken = resetData.resetToken;
    await user.save();

    return { message: "Password reset successfully" };
  }

  /**
   * Validate reset token
   */
  async validateResetToken(token: string): Promise<{ isValid: boolean }> {
    try {
      // Verify JWT reset token
      const payload = tokenService.verifyToken(token);

      if (!payload || payload.type !== "reset") {
        return { isValid: false };
      }

      // Find user by ID from token
      const user = await User.findById(payload.userId).select(
        "+lastUsedResetToken"
      );

      if (!user) {
        return { isValid: false };
      }

      // Check if this token has already been used
      if (user.lastUsedResetToken === token) {
        return { isValid: false };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false };
    }
  }

  /**
   * Debug method to test password hashing
   */
  async debugPasswordHash(password: string): Promise<string> {
    const hash = await this.hashPassword(password);
    console.log(`🔍 Debug: Password "${password}" hashes to: ${hash}`);
    return hash;
  }
}

export const passwordService = new PasswordService();
