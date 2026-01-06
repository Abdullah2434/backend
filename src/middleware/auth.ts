import { Request, Response, NextFunction } from "express";
import AuthService from "../services/auth.service";
import { JwtPayload, AuthenticatedRequest } from "../types";

const authService = new AuthService();

// Route configurations matching Next.js
const AUTH_ROUTES = {
  // Public routes (no auth required, but rate limited)
  PUBLIC: [
    "/auth/login",
    "/auth/register",
    "/auth/admin/login",
    "/auth/admin/create-user",
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
    "/video/mute",
    "/video/download",
    "/video/create",
    "/api/video/create",
    "/video/generate-video",
    "/api/video/generate-video",
    "/elevenlabs/text-to-speech",
    "/api/elevenlabs/text-to-speech",
    "/webhook/workflow-error",
    "/api/webhook/workflow-error",
    // Also check without /api prefix since middleware is applied to /api routes
    "/video/create",
    "/video/generate-video",
    "/elevenlabs/text-to-speech",
    "/socialbu/login",
    "/socialbu/save-token",
    "/socialbu/test",
    "/socialbu/accounts/connect",
    "/webhook/socialbu",
    "/webhook/test",
    "/schedule/test",
    "/subscription/plans",
    "/subscription/current",
  ],

  // Protected routes (auth required)
  PROTECTED: [
    "/auth/me",
    "/auth/profile",
    "/auth/clear-expired-tokens",
    "/admin",
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
    "/schedule",
    "/payment-methods",
    "/elevenlabs/voices/add",
    "/subscription",
    "/video",
    "/user/avatar-videos",
    "/video_avatar",
    "/music/trending",
  ],

  // Video routes (auth required)
  VIDEO: ["/video/gallery", "/video/delete", "/video/download-proxy"],
};

/**
 * Check if route requires authentication
 * Note: Public routes are checked first in authenticate(), so this only applies to non-public routes
 */
export function requiresAuth(pathname: string): boolean {
  // Don't require auth if it's a public route (double-check)
  if (isPublicRoute(pathname)) {
    return false;
  }
  
  return (
    AUTH_ROUTES.PROTECTED.some((route) => {
      // For generic routes like "/video", exclude public video routes
      if (route === "/video") {
        const publicVideoRoutes = ["/video/create", "/video/generate-video", "/video/mute", "/video/download", "/video/track-execution"];
        if (publicVideoRoutes.some(publicRoute => pathname.startsWith(publicRoute))) {
          return false;
        }
      }
      return pathname.startsWith(route);
    }) ||
    AUTH_ROUTES.VIDEO.some((route) => pathname.startsWith(route))
  );
}

/**
 * Check if route is public
 */
export function isPublicRoute(pathname: string): boolean {
  // Check exact matches first, then startsWith
  return AUTH_ROUTES.PUBLIC.some((route) => {
    // Exact match
    if (pathname === route) return true;
    // Starts with match (for paths like /api/video/create matching /video/create)
    if (pathname.startsWith(route)) return true;
    // Also check without /api prefix (since middleware is on /api routes)
    if (pathname.startsWith("/api" + route)) return true;
    // Check if route without /api matches path without /api
    if (route.startsWith("/api") && pathname.startsWith(route.substring(4))) return true;
    return false;
  });
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

    // Skip auth for public routes
    if (isPublicRoute(path)) {
      return next();
    }

    // Check if route requires authentication
    if (!requiresAuth(path)) {
      return next();
    }

    // Extract access token from query parameter or Authorization header
    // For download-proxy route, allow token in query parameter for native downloads
    const isDownloadProxyRoute =
      path === "/api/video/download-proxy" ||
      path === "/video/download-proxy" ||
      path.includes("/download-proxy");
    const tokenFromQuery = isDownloadProxyRoute
      ? String((req.query as any).token || "").trim()
      : "";
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.replace("Bearer ", "") || "";

    // Use token from query parameter if provided, otherwise fall back to header
    const accessToken = tokenFromQuery || tokenFromHeader;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message:
          "Access token is required (provide via ?token=xxx or Authorization header)",
      });
    }

    // Validate token and extract user
    const user = await extractUserFromToken(accessToken);
    if (!user) {
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
      role: user.role,
    };
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
          role: user.role,
        };
      }
    }

    next();
  };
}

/**
 * Require admin role middleware
 * Must be used after authenticate() middleware
 */
export function requireAdmin() {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    next();
  };
}
