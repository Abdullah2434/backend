import crypto from "crypto";
import User, { IUser } from "../../../models/User";
import {
  sendVerificationEmail,
  sendResendVerificationEmail,
  sendWelcomeEmail,
} from "../../../services/email";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../../core/errors";

export class VerificationService {
  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ user: IUser; message: string }> {
    console.log(`🔍 Verifying email with token: ${token}`);

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    console.log(`🔍 Verifying email with token hash: ${hashedToken}`);

    // Find user with this verification token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new ValidationError("Invalid or expired verification token");
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

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await User.findOne({ email });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.isEmailVerified) {
      throw new ConflictError("Email is already verified");
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

  /**
   * Send initial verification email
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    firstName: string
  ): Promise<void> {
    await sendVerificationEmail(email, token, firstName);
  }
}

export const verificationService = new VerificationService();
