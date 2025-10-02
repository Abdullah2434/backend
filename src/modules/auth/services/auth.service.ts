import crypto from "crypto";
import User, { IUser } from "../../../models/User";
import { tokenService } from "./token.service";
import { passwordService } from "./password.service";
import { verificationService } from "./verification.service";
import {
  ConflictError,
  AuthenticationError,
  NotFoundError,
} from "../../../core/errors";
import { sendWelcomeEmail } from "../../../services/email";
import {
  RegisterData,
  LoginData,
  GoogleUserData,
  AuthResult,
  GoogleAuthResult,
} from "../types/auth.types";

export class AuthService {
  /**
   * Register a new user
   */
  async register(userData: RegisterData): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    // Create new user (password will be hashed by model middleware)
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
    const accessToken = tokenService.generateAccessToken(
      user._id.toString(),
      user.email
    );

    // Send verification email
    await verificationService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.firstName
    );

    return { user, accessToken };
  }

  /**
   * Login user
   */
  async login(loginData: LoginData): Promise<AuthResult> {
    console.log(`🔍 Login attempt for email: ${loginData.email}`);

    // Find user by email and include password
    const user = await User.findOne({ email: loginData.email }).select(
      "+password"
    );

    if (!user) {
      console.log(`❌ User not found for email: ${loginData.email}`);
      throw new AuthenticationError("Invalid email or password");
    }

    console.log(`✅ User found: ${user.email}`);

    // Check if password is correct
    const isPasswordValid = await passwordService.comparePassword(
      loginData.password,
      user.password
    );

    if (!isPasswordValid) {
      console.log(`❌ Password validation failed for user: ${user.email}`);
      throw new AuthenticationError("Invalid email or password");
    }

    console.log(`✅ Password validation successful for user: ${user.email}`);

    // Generate new JWT access token
    const accessToken = tokenService.generateAccessToken(
      user._id.toString(),
      user.email
    );

    return { user, accessToken };
  }

  /**
   * Google OAuth login/register
   */
  async googleLogin(googleData: GoogleUserData): Promise<GoogleAuthResult> {
    // Check if user exists with this Google ID
    let user = await User.findOne({ googleId: googleData.googleId });

    if (user) {
      // Existing Google user - generate new JWT token
      const accessToken = tokenService.generateAccessToken(
        user._id.toString(),
        user.email
      );

      return { user, accessToken, isNewUser: false };
    }

    // Check if user exists with this email (but different login method)
    user = await User.findOne({ email: googleData.email });

    if (user) {
      // User exists but not with Google - link Google account
      user.googleId = googleData.googleId;
      user.googleEmail = googleData.email;
      user.isEmailVerified = true; // Google emails are pre-verified

      const accessToken = tokenService.generateAccessToken(
        user._id.toString(),
        user.email
      );
      await user.save();

      // Send welcome email for existing users who just linked their Google account
      try {
        await sendWelcomeEmail(user.email, user.firstName);
      } catch (emailError) {
        console.error(
          `Failed to send welcome email to linked Google user ${user.email}:`,
          emailError
        );
        // Don't fail the entire login if email fails
      }

      return { user, accessToken, isNewUser: false };
    }

    // Create new user with Google data
    const randomPassword = crypto.randomBytes(32).toString("hex");

    user = new User({
      firstName: googleData.firstName,
      lastName: googleData.lastName,
      email: googleData.email,
      googleId: googleData.googleId,
      googleEmail: googleData.email,
      isEmailVerified: true, // Google emails are pre-verified
      password: randomPassword,
    });

    const accessToken = tokenService.generateAccessToken(
      user._id.toString(),
      user.email
    );
    await user.save();

    // Send welcome email for new Google users
    try {
      await sendWelcomeEmail(user.email, user.firstName);
    } catch (emailError) {
      console.error(
        `Failed to send welcome email to new Google user ${user.email}:`,
        emailError
      );
      // Don't fail the entire registration if email fails
    }

    return { user, accessToken, isNewUser: true };
  }

  /**
   * Get current user by access token
   */
  async getCurrentUser(accessToken: string): Promise<IUser | null> {
    try {
      // Verify JWT token
      const payload = tokenService.verifyToken(accessToken);
      if (!payload) {
        return null;
      }

      // Find user by ID from token payload
      const user = await User.findById(payload.userId);
      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get current user with subscription information
   */
  async getCurrentUserWithSubscription(accessToken: string): Promise<any> {
    try {
      // Verify JWT token
      const payload = tokenService.verifyToken(accessToken);
      if (!payload) {
        return null;
      }

      // Find user by ID from token payload
      const user = await User.findById(payload.userId);
      if (!user) {
        return null;
      }

      // Get subscription information
      const { subscriptionService } = await import(
        "../../subscription/services/subscription.service"
      );
      const subscription = await subscriptionService.getActiveSubscription(
        payload.userId
      );

      return {
        ...user.toObject(),
        subscription,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updateData: Partial<Pick<IUser, "firstName" | "lastName" | "phone">>
  ): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Update allowed fields
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
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await User.findOne({ email });
    return !!user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email });
  }

  /**
   * Validate access token
   */
  async validateAccessToken(accessToken: string): Promise<boolean> {
    return tokenService.validateAccessToken(accessToken);
  }

  /**
   * Clear expired tokens from database
   */
  async clearExpiredTokens(): Promise<{ message: string }> {
    const now = new Date();

    await User.updateMany(
      {
        $or: [
          { emailVerificationExpires: { $lt: now } },
          { resetPasswordExpires: { $lt: now } },
        ],
      },
      {
        $unset: {
          emailVerificationToken: 1,
          emailVerificationExpires: 1,
          resetPasswordToken: 1,
          resetPasswordExpires: 1,
        },
      }
    );

    return { message: "Expired tokens cleared successfully" };
  }

  /**
   * Logout user (JWT is stateless, so just return success)
   */
  async logout(userId: string): Promise<void> {
    // JWT is stateless, so we don't need to clear anything from database
    // The client should remove the token from localStorage
    return Promise.resolve();
  }
}

export const authService = new AuthService();
