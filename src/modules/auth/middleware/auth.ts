import { Request, Response, NextFunction } from "express";
import AuthService from "../services/auth.service";
import { JwtPayload, AuthenticatedRequest } from "../../../types";

const authService = new AuthService();

// Route configurations matching Next.js
const AUTH_ROUTES = {
  // Public routes (no auth required, but rate limited)
  PUBLIC: [
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/auth/resend-verification",
    "/auth/check-email",
    "/auth/check-email-verification",
    "/auth/validate-token",
    "/auth/google",
    "/auth/csrf-token",
    "/video/track-execution",
    "/webhook/workflow-error",
    "/socialbu/login",
    "/socialbu/save-token",
    "/socialbu/test",
    "/socialbu/accounts/connect",
    "/webhook/socialbu",
    "/webhook/test",
    "/schedule/test",
  ],

  // Protected routes (auth required)
  PROTECTED: [
    "/auth/me",
    "/auth/profile",
    "/auth/clear-expired-tokens",
    "/video/topics/:id",
    "/video/topics",
    "/video/topics/:topic",
    "/trends/real-estate",
    "/socialbu/accounts",
    "/socialbu/accounts/public",
    "/socialbu/test-auth",
    "/socialbu-media",
    "/socialbu-account",
    "/video-schedule/schedule",
    "/video-schedule/schedule/details",
    "/video-schedule/schedule/stats",
    "/video-schedule/schedule/:scheduleId",
    "/v2/video_avatar",
    "/api/v2/video_avatar",
    "/elevenlabs/voices/add",
  ],

  // Video routes (auth required)
  VIDEO: ["/video/gallery", "/video/delete", "/video/download-proxy"],
};

/**
 * Check if route requires authentication
 */
export function requiresAuth(pathname: string): boolean {
  return (
    AUTH_ROUTES.PROTECTED.some((route) => pathname.startsWith(route)) ||
    AUTH_ROUTES.VIDEO.some((route) => pathname.startsWith(route))
  );
}

/**
 * Check if route is public
 */
export function isPublicRoute(pathname: string): boolean {
  return AUTH_ROUTES.PUBLIC.some((route) => pathname.startsWith(route));
}

/**
 * Extract user from JWT token
 */
async function extractUserFromToken(token: string) {
  try {
    const payload = authService.verifyToken(token) as JwtPayload;
    if (!payload) return null;

    const user = await authService.getCurrentUser(token);
    return user;
  } catch (error) {
    console.error("Token extraction error:", error);
    return null;
  }
}

/**
 * Authentication middleware
 */
export function authenticate() {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { path } = req;

    console.log(`🔐 Auth Middleware: Processing ${req.method} ${path}`);

    // Skip auth for public routes
    if (isPublicRoute(path)) {
      console.log(`🔐 Auth Middleware: Public route ${path}`);
      return next();
    }

    // Check if route requires authentication
    if (!requiresAuth(path)) {
      console.log(`🔐 Auth Middleware: No auth required for ${path}`);
      return next();
    }

    // Extract access token
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      console.log(`🔐 Auth Middleware: No access token for ${path}`);
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    // Validate token and extract user
    const user = await extractUserFromToken(accessToken);
    console.log(`🔐 Auth Middleware: Extracted user for ${path}:`, user);
    if (!user) {
      console.log(`🔐 Auth Middleware: Invalid access token for ${path}`);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }

    // Add user to request object
    req.user = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    console.log(`🔐 Auth Middleware: Set req.user for ${path}:`, req.user);

    console.log(`🔐 Auth Middleware: Authentication successful for ${path}`);
    next();
  };
}

/**
 * Optional authentication middleware (doesn't block if no token)
 */
export function optionalAuthenticate() {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    if (accessToken) {
      const user = await extractUserFromToken(accessToken);
      if (user) {
        req.user = {
          _id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }
    }

    next();
  };
}
