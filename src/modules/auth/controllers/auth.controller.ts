import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, email, phone, password } = req.body;

  const result = await authService.register({
    firstName,
    lastName,
    email,
    phone: phone || "",
    password,
  });

  return ResponseHelper.created(
    res,
    "User registered successfully. Please check your email for verification.",
    {
      user: {
        id: result.user._id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        phone: result.user.phone,
        isEmailVerified: result.user.isEmailVerified,
      },
      accessToken: result.accessToken,
    }
  );
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await authService.login({ email, password });

  // Check if email is verified
  if (!result.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message:
        "Please verify your email address before logging in. Check your inbox for the verification link.",
      data: {
        requiresVerification: true,
        email: result.user.email,
      },
    });
  }

  return ResponseHelper.success(res, "Login successful", {
    user: {
      id: result.user._id,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      phone: result.user.phone,
      isEmailVerified: result.user.isEmailVerified,
    },
    accessToken: result.accessToken,
  });
});

/**
 * Google OAuth login
 */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { googleId, email, firstName, lastName } = req.body;

  const result = await authService.googleLogin({
    googleId,
    email,
    firstName,
    lastName,
  });

  // For existing users (not new Google users), check email verification
  if (!result.isNewUser && !result.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message:
        "Please verify your email address before logging in. Check your inbox for the verification link.",
      data: {
        requiresVerification: true,
        email: result.user.email,
      },
    });
  }

  return ResponseHelper.success(
    res,
    result.isNewUser
      ? "User registered successfully with Google"
      : "Login successful",
    {
      user: {
        id: result.user._id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        phone: result.user.phone || "",
        isEmailVerified: result.user.isEmailVerified,
        googleId: result.user.googleId,
      },
      accessToken: result.accessToken,
      isNewUser: result.isNewUser,
    }
  );
});

/**
 * Logout user
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");

  if (token) {
    const user = await authService.getCurrentUser(token);
    if (user) {
      await authService.logout(user._id.toString());
    }
  }

  return ResponseHelper.success(res, "Logged out successfully");
});

/**
 * Check if email exists
 */
export const checkEmail = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.query.email || "");

  const exists = await authService.emailExists(email);

  return ResponseHelper.success(res, "Email check completed", { exists });
});

/**
 * Check email verification status
 */
export const checkEmailVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    const user = await authService.getUserByEmail(email);

    if (!user) {
      return ResponseHelper.notFound(res, "User not found");
    }

    return ResponseHelper.success(res, "Email verification status retrieved", {
      isVerified: user.isEmailVerified,
      email: user.email,
    });
  }
);

/**
 * Validate access token
 */
export const validateToken = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.body;

    const isValid = await authService.validateAccessToken(token);

    if (!isValid) {
      return ResponseHelper.unauthorized(res, "Invalid or expired token");
    }

    const user = await authService.getCurrentUser(token);

    if (!user) {
      return ResponseHelper.unauthorized(res, "User not found");
    }

    return ResponseHelper.success(res, "Token is valid", {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
      },
      tokenType: "access",
    });
  }
);

/**
 * Clear expired tokens
 */
export const clearExpiredTokens = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await authService.clearExpiredTokens();
    return ResponseHelper.success(res, result.message);
  }
);
