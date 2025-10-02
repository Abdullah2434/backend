import * as bcrypt from "bcryptjs";
import User, { IUser } from "../../../database/models/User";
import { sendVerificationEmail } from "../../../modules/shared/email";
import {
  RegisterData,
  LoginData,
  UpdateProfileData,
  AuthResult,
  AuthConfig,
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from "../types/auth.types";
import AuthTokenService from "./auth-token.service";

export class AuthUserService {
  private readonly tokenService: AuthTokenService;
  private readonly config: AuthConfig;

  constructor() {
    this.tokenService = new AuthTokenService();
    this.config = this.tokenService.getConfig();
  }

  // ==================== USER REGISTRATION ====================

  async register(userData: RegisterData): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new ConflictError("User with this email already exists");
      }

      // Create new user
      const user = new User({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        password: userData.password,
      });

      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Generate JWT access token
      const accessToken = this.tokenService.generateToken(
        user._id.toString(),
        user.email
      );

      // Send verification email
      await sendVerificationEmail(
        user.email,
        verificationToken,
        user.firstName
      );

      return { user, accessToken };
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new AuthenticationError("Registration failed", 500);
    }
  }

  // ==================== USER LOGIN ====================

  async login(loginData: LoginData): Promise<AuthResult> {
    try {
      console.log("🔍 Login attempt:", {
        email: loginData.email,
        hasPassword: !!loginData.password,
      });

      // Find user by email and include password
      const user = await User.findOne({ email: loginData.email }).select(
        "+password"
      );

      console.log("🔍 User found:", {
        userId: user?._id,
        email: user?.email,
        hasPassword: !!user?.password,
        isEmailVerified: user?.isEmailVerified,
      });

      if (!user) {
        console.log("❌ User not found");
        throw new AuthenticationError("Invalid email or password");
      }

      if (!user.password) {
        console.log("❌ User has no password (Google user?)");
        throw new AuthenticationError("Invalid email or password");
      }

      // Check if password is correct
      const isPasswordValid = await bcrypt.compare(
        loginData.password,
        user.password
      );

      console.log("🔍 Password validation:", {
        isPasswordValid,
        providedPasswordLength: loginData.password.length,
      });

      if (!isPasswordValid) {
        console.log("❌ Invalid password");
        throw new AuthenticationError("Invalid email or password");
      }

      // Generate JWT access token
      const accessToken = this.tokenService.generateToken(
        user._id.toString(),
        user.email
      );

      // Remove password from user object before returning
      const userWithoutPassword = user.toObject();
      delete userWithoutPassword.password;

      console.log("✅ Login successful");
      return { user: userWithoutPassword, accessToken };
    } catch (error) {
      console.log("❌ Login error:", error);
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError("Login failed", 500);
    }
  }

  // ==================== USER MANAGEMENT ====================

  async getCurrentUser(token: string): Promise<IUser | null> {
    try {
      const payload = this.tokenService.verifyToken(token);
      if (!payload) {
        return null;
      }

      const user = await User.findById(payload.userId);
      return user;
    } catch (error) {
      return null;
    }
  }

  async updateProfile(
    userId: string,
    updateData: UpdateProfileData
  ): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Update user fields
      if (updateData.firstName !== undefined) {
        user.firstName = updateData.firstName;
      }
      if (updateData.lastName !== undefined) {
        user.lastName = updateData.lastName;
      }
      if (updateData.phone !== undefined) {
        user.phone = updateData.phone;
      }

      await user.save();
      return user;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new AuthenticationError("Profile update failed", 500);
    }
  }

  async logout(userId: string): Promise<void> {
    try {
      // In a more sophisticated implementation, you might:
      // 1. Add the token to a blacklist
      // 2. Update user's last logout time
      // 3. Clear any server-side sessions

      // For now, we'll just log the logout event
      console.log(`User ${userId} logged out`);
    } catch (error) {
      // Logout should not fail even if there are issues
      console.error("Logout error:", error);
    }
  }

  // ==================== UTILITY METHODS ====================

  async getUserByEmail(email: string): Promise<IUser | null> {
    try {
      return await User.findOne({ email });
    } catch (error) {
      return null;
    }
  }

  async getUserById(userId: string): Promise<IUser | null> {
    try {
      return await User.findById(userId);
    } catch (error) {
      return null;
    }
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      database: "available" | "unavailable";
      tokenService: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      const tokenHealth = await this.tokenService.healthCheck();

      // Test database connection
      const testUser = await User.findOne().limit(1);

      return {
        status: tokenHealth.status === "healthy" ? "healthy" : "unhealthy",
        services: {
          database: "available",
          tokenService: tokenHealth.services.jwt,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          database: "unavailable",
          tokenService: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default AuthUserService;
