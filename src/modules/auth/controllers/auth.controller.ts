import { Response } from "express";
import AuthService from "../services/auth.service";
import {
  RegisterRequest,
  LoginRequest,
  GoogleLoginRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  VerifyEmailRequest,
  ValidateTokenRequest,
  AuthResponse,
  UserResponse,
} from "../types/auth.types";

const authService = new AuthService();

const formatUserResponse = (user: any): UserResponse => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone || "",
  isEmailVerified: user.isEmailVerified,
  googleId: user.googleId,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: any
): void => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data,
  });
};

export const register = async (
  req: RegisterRequest,
  res: Response
): Promise<void> => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    const result = await authService.register({
      firstName,
      lastName,
      email,
      phone: phone || "",
      password,
    });
    sendResponse(
      res,
      201,
      "User registered successfully. Please check your email for verification.",
      {
        user: formatUserResponse(result.user),
        accessToken: result.accessToken,
      }
    );
  } catch (error: any) {
    sendResponse(
      res,
      error.statusCode || 400,
      error.message || "Registration failed"
    );
  }
};

export const login = async (
  req: LoginRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    if (!result.user.isEmailVerified) {
      sendResponse(
        res,
        403,
        "Please verify your email address before logging in. Check your inbox for the verification link."
      );
      return;
    }
    sendResponse(res, 200, "Login successful", {
      user: formatUserResponse(result.user),
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    sendResponse(res, error.statusCode || 401, error.message || "Login failed");
  }
};

export const googleLogin = async (
  req: GoogleLoginRequest,
  res: Response
): Promise<void> => {
  try {
    const { googleId, email, firstName, lastName } = req.body;
    console.log("🔍 Google login attempt:", {
      googleId: googleId?.substring(0, 10) + "...",
      email,
      firstName,
      lastName,
    });

    const result = await authService.googleLogin({
      googleId,
      email,
      firstName,
      lastName,
    });

    console.log("✅ Google login successful:", {
      isNewUser: result.isNewUser,
      userId: result.user._id,
    });

    if (!result.isNewUser && !result.user.isEmailVerified) {
      sendResponse(
        res,
        403,
        "Please verify your email address before logging in. Check your inbox for the verification link."
      );
      return;
    }
    const message = result.isNewUser
      ? "User registered successfully with Google"
      : "Login successful";
    sendResponse(res, 200, message, {
      user: formatUserResponse(result.user),
      accessToken: result.accessToken,
      isNewUser: result.isNewUser,
    });
  } catch (error: any) {
    console.log("❌ Google login failed:", error.message);
    console.log("❌ Error stack:", error.stack);
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Google login failed"
    );
  }
};

export const me = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendResponse(res, 401, "User not found");
      return;
    }
    sendResponse(res, 200, "User profile retrieved successfully", {
      user: formatUserResponse(user),
    });
  } catch (error: any) {
    sendResponse(res, 500, error.message || "Failed to get user profile");
  }
};

export const updateProfile = async (
  req: UpdateProfileRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendResponse(res, 401, "User not found");
      return;
    }
    const { firstName, lastName, phone } = req.body;
    const updatedUser = await authService.updateProfile(user._id.toString(), {
      firstName,
      lastName,
      phone,
    });
    sendResponse(res, 200, "Profile updated successfully", {
      user: formatUserResponse(updatedUser),
    });
  } catch (error: any) {
    sendResponse(
      res,
      error.statusCode || 400,
      error.message || "Profile update failed"
    );
  }
};

export const logout = async (req: any, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (user) await authService.logout(user._id.toString());
    sendResponse(res, 200, "Logged out successfully");
  } catch (error: any) {
    sendResponse(res, 200, "Logged out successfully");
  }
};

export const forgotPassword = async (
  req: ForgotPasswordRequest,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    sendResponse(res, 200, result.message);
  } catch (error: any) {
    sendResponse(
      res,
      error.statusCode || 400,
      error.message || "Password reset request failed"
    );
  }
};

export const resetPassword = async (
  req: ResetPasswordRequest,
  res: Response
): Promise<void> => {
  try {
    console.log("🔍 Reset password request body:", {
      body: req.body,
      hasResetToken: !!req.body?.resetToken,
      hasNewPassword: !!req.body?.newPassword,
      resetTokenLength: req.body?.resetToken?.length,
      newPasswordLength: req.body?.newPassword?.length,
    });

    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      console.log("❌ Missing required fields:", {
        resetToken: !!resetToken,
        newPassword: !!newPassword,
      });
      sendResponse(res, 400, "Reset token and new password are required");
      return;
    }

    const result = await authService.resetPassword({ resetToken, newPassword });
    console.log("✅ Password reset successful");
    sendResponse(res, 200, result.message);
  } catch (error: any) {
    console.log("❌ Password reset failed:", error.message);
    sendResponse(
      res,
      error.statusCode || 400,
      error.message || "Password reset failed"
    );
  }
};

export const verifyEmail = async (
  req: VerifyEmailRequest,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.query;
    console.log("🔍 Email verification attempt:", {
      token: token?.substring(0, 10) + "...",
    });

    if (!token) {
      console.log("❌ No token provided");
      sendResponse(res, 400, "Verification token is required");
      return;
    }

    const result = await authService.verifyEmail(token);
    console.log("✅ Email verification successful");
    sendResponse(res, 200, result.message, {
      user: formatUserResponse(result.user),
    });
  } catch (error: any) {
    console.log("❌ Email verification failed:", error.message);
    sendResponse(
      res,
      error.statusCode || 400,
      error.message || "Email verification failed"
    );
  }
};

export const resendVerification = async (
  req: ForgotPasswordRequest,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;
    const result = await authService.resendVerificationEmail(email);
    sendResponse(res, 200, result.message);
  } catch (error: any) {
    sendResponse(
      res,
      error.statusCode || 400,
      error.message || "Failed to resend verification email"
    );
  }
};

export const validateToken = async (
  req: ValidateTokenRequest,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.body;
    console.log("🔍 Token validation attempt:", {
      token: token?.substring(0, 10) + "...",
      hasToken: !!token,
    });

    if (!token) {
      console.log("❌ No token provided for validation");
      sendResponse(res, 400, "Token is required");
      return;
    }

    const result = await authService.validateToken(token);
    console.log("🔍 Token validation result:", {
      isValid: result.isValid,
      tokenType: result.tokenType,
      hasUser: !!result.user,
    });

    if (!result.isValid) {
      sendResponse(res, 401, "Invalid or expired token");
      return;
    }

    // For reset tokens, we don't need to return user data
    if (result.tokenType === "reset") {
      sendResponse(res, 200, "Token is valid", {
        tokenType: result.tokenType,
        message: "Reset token is valid",
      });
      return;
    }

    // For access tokens, we need user data
    if (!result.user) {
      console.log("❌ Valid token but no user data returned");
      sendResponse(res, 401, "Token is valid but user data is missing");
      return;
    }

    sendResponse(res, 200, "Token is valid", {
      user: formatUserResponse(result.user),
      tokenType: result.tokenType,
    });
  } catch (error: any) {
    console.log("❌ Token validation failed:", error.message);
    console.log("❌ Error stack:", error.stack);
    sendResponse(res, 500, error.message || "Token validation failed");
  }
};

export const checkEmail = async (req: any, res: Response): Promise<void> => {
  try {
    const { email } = req.query;

    if (!email) {
      sendResponse(res, 400, "Email parameter is required");
      return;
    }

    const exists = await authService.checkEmailExists(email as string);

    sendResponse(res, 200, "Email check completed", {
      email,
      exists,
    });
  } catch (error: any) {
    sendResponse(res, 500, error.message || "Email check failed");
  }
};
