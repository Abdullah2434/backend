import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User, { IUser } from "../models/User";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendResendVerificationEmail,
  sendWelcomeEmail,
} from "./email.service";
import {
  RegisterData,
  LoginData,
  ResetPasswordData,
  GoogleUserData,
  AuthResult,
  GoogleAuthResult,
  JwtPayload,
} from "../types";

export class AuthService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET as string;
    if (!this.jwtSecret) {
      throw new Error("JWT_SECRET environment variable is required");
    }
  }

  // Generate JWT token
  generateToken(userId: string, email: string): string {
    return jwt.sign({ userId, email }, this.jwtSecret, { expiresIn: "7d" });
  }

  // Generate JWT reset token with short expiration
  generateResetToken(userId: string, email: string): string {
    return jwt.sign({ userId, email, type: "reset" }, this.jwtSecret, {
      expiresIn: "15m",
    });
  }

  // Verify JWT token
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  // Decode token without verification
  decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  // Register a new user
  async register(userData: RegisterData): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error("User with this email already exists");
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
    const accessToken = this.generateToken(user._id.toString(), user.email);

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken, user.firstName);

    return { user, accessToken };
  }

  // Login user
  async login(loginData: LoginData): Promise<AuthResult> {
    // Find user by email and include password
    const user = await User.findOne({ email: loginData.email }).select(
      "+password"
    );

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(
      loginData.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    const accessToken = this.generateToken(user._id.toString(), user.email);

    return { user, accessToken };
  }

  // Get current user by access token
  async getCurrentUser(accessToken: string): Promise<IUser | null> {
    try {
      // Verify JWT token
      const payload = this.verifyToken(accessToken);
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

  // Get current user with subscription information
  async getCurrentUserWithSubscription(accessToken: string): Promise<any> {
    try {
      // Verify JWT token
      const payload = this.verifyToken(accessToken);
      if (!payload) {
        return null;
      }

      // Find user by ID from token payload
      const user = await User.findById(payload.userId);
      if (!user) {
        return null;
      }

      // Get subscription information
      const { SubscriptionService } = await import("./payment");
      const subscriptionService = new SubscriptionService();
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

  // Update user profile
  async updateProfile(
    userId: string,
    updateData: Partial<Pick<IUser, "firstName" | "lastName" | "phone">>
  ): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
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

  // Forgot password
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
    const resetToken = this.generateResetToken(user._id.toString(), user.email);

    // Send password reset email
    await sendPasswordResetEmail(user.email, resetToken, user.firstName);

    return {
      message:
        "If an account with that email exists, a password reset link has been sent",
    };
  }

  // Reset password with JWT reset token
  async resetPassword(
    resetData: ResetPasswordData
  ): Promise<{ message: string }> {
    // Verify JWT reset token
    const payload = this.verifyToken(resetData.resetToken);

    if (!payload) {
      throw new Error("Invalid or expired reset token");
    }

    // Check if it's a reset token
    if (payload.type !== "reset") {
      throw new Error("Invalid token type");
    }

    // Find user by ID from token
    const user = await User.findById(payload.userId).select(
      "+password +lastUsedResetToken"
    );

    if (!user) {
      throw new Error("User not found");
    }

    // Check if this token has already been used
    if (user.lastUsedResetToken === resetData.resetToken) {
      throw new Error("Reset token has already been used");
    }

    // Set new password (will be hashed by model middleware)
    user.password = resetData.newPassword;
    user.lastUsedResetToken = resetData.resetToken;
    await user.save();

    return { message: "Password reset successfully" };
  }

  // Validate reset token
  async validateResetToken(token: string): Promise<{ isValid: boolean }> {
    try {
      // Verify JWT reset token
      const payload = this.verifyToken(token);

      if (!payload) {
        return { isValid: false };
      }

      // Check if it's a reset token
      if (payload.type !== "reset") {
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

  // Debug method to test password hashing
  async debugPasswordHash(password: string): Promise<string> {
    const hash = await bcrypt.hash(password, 12);

    return hash;
  }

  // Verify email
  async verifyEmail(token: string): Promise<{ user: IUser; message: string }> {
    // Hash the token to compare with stored hash

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with this verification token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new Error("Invalid or expired verification token");
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined as any;

    await user.save();

    // Send welcome email
    await sendWelcomeEmail(user.email, user.firstName);

    return {
      user,
      message: "Email verified successfully",
    };
  }

  // Resend email verification
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.isEmailVerified) {
      throw new Error("Email is already verified");
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Send resend verification email
    await sendResendVerificationEmail(
      user.email,
      verificationToken,
      user.firstName
    );

    return { message: "Verification email sent successfully" };
  }

  // Google OAuth login/register
  async googleLogin(googleData: GoogleUserData): Promise<GoogleAuthResult> {
    // Check if user exists with this Google ID
    let user = await User.findOne({ googleId: googleData.googleId });

    if (user) {
      // Existing Google user - generate new JWT token
      const accessToken = this.generateToken(user._id.toString(), user.email);

      return { user, accessToken, isNewUser: false };
    }

    // Check if user exists with this email (but different login method)
    user = await User.findOne({ email: googleData.email });

    if (user) {
      // User exists but not with Google - link Google account
      user.googleId = googleData.googleId;
      user.googleEmail = googleData.email;
      user.isEmailVerified = true; // Google emails are pre-verified

      const accessToken = this.generateToken(user._id.toString(), user.email);
      await user.save();

      // Send welcome email for existing users who just linked their Google account
      try {
        await sendWelcomeEmail(user.email, user.firstName);
      } catch (emailError) {
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

    const accessToken = this.generateToken(user._id.toString(), user.email);
    await user.save();

    // Send welcome email for new Google users since their email is pre-verified
    try {
      await sendWelcomeEmail(user.email, user.firstName);
    } catch (emailError) {
      // Don't fail the entire registration if email fails
    }

    return { user, accessToken, isNewUser: true };
  }

  // Check if email exists
  async emailExists(email: string): Promise<boolean> {
    const user = await User.findOne({ email });
    return !!user;
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email });
  }

  // Validate access token
  async validateAccessToken(accessToken: string): Promise<boolean> {
    try {
      const payload = this.verifyToken(accessToken);
      return !!payload;
    } catch {
      return false;
    }
  }

  // Clear expired tokens
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

  // Logout user (JWT is stateless, so we just return success)
  async logout(userId: string): Promise<void> {
    // JWT is stateless, so we don't need to clear anything from database
    // The client should remove the token from localStorage
    return Promise.resolve();
  }
}

export default AuthService;
