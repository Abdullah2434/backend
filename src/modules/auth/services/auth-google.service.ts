import User from "../../../database/models/User";
import { sendWelcomeEmail } from "../../../modules/shared/email";
import {
  GoogleUserData,
  GoogleAuthResult,
  AuthConfig,
  AuthenticationError,
} from "../types/auth.types";
import AuthTokenService from "./auth-token.service";

export class AuthGoogleService {
  private readonly tokenService: AuthTokenService;
  private readonly config: AuthConfig;

  constructor() {
    this.tokenService = new AuthTokenService();
    this.config = this.tokenService.getConfig();
  }

  // ==================== GOOGLE OAUTH ====================

  async googleLogin(googleData: GoogleUserData): Promise<GoogleAuthResult> {
    try {
      const { googleId, email, firstName, lastName } = googleData;
      console.log("🔍 Google service: Starting login process");

      // Check if user already exists with this Google ID
      let user = await User.findOne({ googleId });
      console.log("🔍 Google service: Checked existing user by Google ID");

      if (user) {
        console.log("🔍 Google service: Found existing user by Google ID");
        // User exists, generate new token
        const accessToken = this.tokenService.generateToken(
          user._id.toString(),
          user.email
        );
        return {
          user: user.toObject(),
          accessToken,
          isNewUser: false,
        };
      }

      // Check if user exists with this email but different Google ID
      const existingUser = await User.findOne({ email });
      console.log("🔍 Google service: Checked existing user by email");

      if (existingUser) {
        console.log(
          "🔍 Google service: Found existing user by email, linking Google account"
        );
        // Link Google account to existing user
        existingUser.googleId = googleId;
        existingUser.isEmailVerified = true; // Google emails are considered verified
        await existingUser.save();

        const accessToken = this.tokenService.generateToken(
          existingUser._id.toString(),
          existingUser.email
        );

        return {
          user: existingUser.toObject(),
          accessToken,
          isNewUser: false,
        };
      }

      console.log("🔍 Google service: Creating new user");
      // Create new user
      const newUser = new User({
        googleId,
        email,
        firstName,
        lastName,
        isEmailVerified: true, // Google emails are considered verified
        password: undefined, // No password for Google users
      });

      await newUser.save();
      console.log("🔍 Google service: New user saved successfully");

      // Send welcome email
      console.log("🔍 Google service: Sending welcome email");
      await sendWelcomeEmail(newUser.email, newUser.firstName);
      console.log("🔍 Google service: Welcome email sent successfully");

      const accessToken = this.tokenService.generateToken(
        newUser._id.toString(),
        newUser.email
      );

      return {
        user: newUser.toObject(),
        accessToken,
        isNewUser: true,
      };
    } catch (error) {
      console.log("❌ Google service error:", error);
      throw new AuthenticationError("Google login failed", 500);
    }
  }

  async linkGoogleAccount(
    userId: string,
    googleData: GoogleUserData
  ): Promise<{ message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AuthenticationError("User not found", 404);
      }

      // Check if Google account is already linked to another user
      const existingGoogleUser = await User.findOne({
        googleId: googleData.googleId,
      });
      if (existingGoogleUser && existingGoogleUser._id.toString() !== userId) {
        throw new AuthenticationError(
          "Google account is already linked to another user",
          409
        );
      }

      // Link Google account
      user.googleId = googleData.googleId;
      if (!user.isEmailVerified) {
        user.isEmailVerified = true; // Google emails are considered verified
      }
      await user.save();

      return {
        message: "Google account linked successfully",
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError("Failed to link Google account", 500);
    }
  }

  async unlinkGoogleAccount(userId: string): Promise<{ message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AuthenticationError("User not found", 404);
      }

      if (!user.googleId) {
        throw new AuthenticationError("No Google account linked", 400);
      }

      // Check if user has a password (can't unlink if no other login method)
      if (!user.password) {
        throw new AuthenticationError(
          "Cannot unlink Google account. Please set a password first.",
          400
        );
      }

      // Unlink Google account
      user.googleId = undefined;
      await user.save();

      return {
        message: "Google account unlinked successfully",
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError("Failed to unlink Google account", 500);
    }
  }

  // ==================== GOOGLE UTILITIES ====================

  async isGoogleAccountLinked(userId: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      return !!(user && user.googleId);
    } catch (error) {
      return false;
    }
  }

  async getGoogleUserByGoogleId(googleId: string): Promise<any> {
    try {
      return await User.findOne({ googleId });
    } catch (error) {
      return null;
    }
  }

  async getGoogleUserByEmail(email: string): Promise<any> {
    try {
      return await User.findOne({ email, googleId: { $exists: true } });
    } catch (error) {
      return null;
    }
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      tokenService: "available" | "unavailable";
      database: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      const tokenHealth = await this.tokenService.healthCheck();

      // Test database connection
      const testUser = await User.findOne({
        googleId: { $exists: true },
      }).limit(1);

      return {
        status: tokenHealth.status === "healthy" ? "healthy" : "unhealthy",
        services: {
          tokenService: tokenHealth.services.jwt,
          database: "available",
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          tokenService: "unavailable",
          database: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default AuthGoogleService;
