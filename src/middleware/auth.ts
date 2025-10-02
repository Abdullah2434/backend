import { Request, Response, NextFunction } from "express";
import { authService } from "../modules/auth/services/auth.service";
import { tokenService } from "../modules/auth/services/token.service";
import { JwtPayload, AuthenticatedRequest } from "../types";

// Route configurations matching Next.js
const AUTH_ROUTES = {
  // Public routes (no auth required, accessible to everyone)
  PUBLIC: [
    // Auth routes (public)
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/verify-email",
    "/api/auth/resend-verification",
    "/api/auth/check-email",
    "/api/auth/check-email-verification",
    "/api/auth/validate-token",
    "/api/auth/validate-reset-token",
    "/api/auth/google",
    "/api/auth/csrf-token",
    "/api/auth/debug-password-hash",

    // Subscription routes (public)
    "/api/subscription/plans", // Get available plans
    "/api/subscription/current", // Get current subscription (works with or without auth)
    "/api/subscription/debug-webhook", // Debug webhook

    // Video routes (public)
    "/api/video/track-execution",
    "/api/video/avatars", // Get available avatars
    "/api/video/voices", // Get available voices
    "/api/video/topics", // Get all topics
    "/api/video/topics/id/", // Get topic by ID
    "/api/video/topics/", // Get topic by type
    "/api/video/pending-workflows/", // Check pending workflows

    // Webhook routes (public)
    "/api/webhook/workflow-error",
    "/api/webhook/stripe",
    "/api/webhook/socialbu",
    "/api/webhook/test",
    "/api/webhook/video-complete",

    // SocialBu routes (public)
    "/api/socialbu/login",
    "/api/socialbu/save-token",
    "/api/socialbu/test",
    "/api/socialbu/accounts/connect",
    "/api/socialbu/accounts/public", // Public accounts endpoint

    // Contact route (public)
    "/api/contact",

    // Health check routes
    "/health",
    "/mongo-status",
  ],

  // Protected routes (auth required)
  PROTECTED: [
    "/api/auth/me",
    "/api/auth/profile",
    "/api/auth/logout",
    "/api/auth/clear-expired-tokens",

    // Video routes (protected)
    "/api/video/gallery",
    "/api/video/delete",
    "/api/video/download-proxy",
    "/api/video/download",
    "/api/video/status",
    "/api/video/create",
    "/api/video/generate-video",
    "/api/video/photo-avatar",

    // Subscription routes (protected)
    "/api/subscription/create",
    "/api/subscription/update",
    "/api/subscription/cancel",
    "/api/subscription/usage",
    "/api/subscription/sync-from-stripe",
    "/api/subscription/payment-methods",
    "/api/subscription/payment-intent",
    "/api/subscription/billing-history",
    "/api/subscription/billing-summary",
    "/api/subscription/billing/sync-from-stripe",

    // Payment methods (protected)
    "/api/payment-methods",

    // Trends (protected)
    "/api/trends/real-estate",

    // SocialBu routes (protected)
    "/api/socialbu/accounts", // User's accounts
    "/api/socialbu/test-auth",

    // SocialBu Media (protected)
    "/api/socialbu-media",

    // SocialBu Account management (protected)
    "/api/socialbu-account",
  ],
};

/**
 * Check if route is public (no auth required)
 */
export function isPublicRoute(pathname: string): boolean {
  // Direct match for exact routes
  if (AUTH_ROUTES.PUBLIC.includes(pathname)) {
    return true;
  }

  // Check if path starts with any public route
  return AUTH_ROUTES.PUBLIC.some((route) => {
    // Handle trailing slashes for pattern matching
    if (route.endsWith("/")) {
      return pathname.startsWith(route);
    }
    // Exact match or starts with route followed by /
    return pathname === route || pathname.startsWith(route + "/");
  });
}

/**
 * Check if route requires authentication
 */
export function requiresAuth(pathname: string): boolean {
  // First check if it's a public route
  if (isPublicRoute(pathname)) {
    return false;
  }

  // Check if explicitly marked as protected
  const isProtected = AUTH_ROUTES.PROTECTED.some((route) => {
    return pathname === route || pathname.startsWith(route + "/");
  });

  // If not in protected list, check if it starts with /api/
  // (default to requiring auth for API routes not explicitly marked public)
  if (!isProtected && pathname.startsWith("/api/")) {
    return true;
  }

  return isProtected;
}

/**
 * Extract user from JWT token
 */
async function extractUserFromToken(token: string) {
  try {
    const payload = tokenService.verifyToken(token) as JwtPayload;
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
    if (!user) {
      console.log(`🔐 Auth Middleware: Invalid access token for ${path}`);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }

    // Add user to request object
    req.user = {
      id: user._id.toString(),
      email: user.email,
    };

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
          id: user._id.toString(),
          email: user.email,
        };
      }
    }

    next();
  };
}
