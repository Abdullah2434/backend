import { AuthenticatedRequest } from "../types";

// ==================== HELPER FUNCTIONS ====================

/**
 * Get user ID from authenticated request
 */
export function getUserIdFromRequest(req: AuthenticatedRequest): string {
  if (!req.user?._id) {
    throw new Error("User not authenticated");
  }
  return req.user._id.toString();
}

/**
 * Extract access token from request headers
 */
export function extractAccessToken(req: AuthenticatedRequest): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.replace("Bearer ", "") || null;
}

/**
 * Parse socialbuAccountId from string to number
 */
export function parseSocialbuAccountId(socialbuAccountId: string): number {
  const parsed = parseInt(socialbuAccountId, 10);
  if (isNaN(parsed)) {
    throw new Error("SocialBu account ID must be a valid number");
  }
  return parsed;
}

/**
 * Determine HTTP status code based on error message
 */
export function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("token") ||
    message.includes("not authenticated") ||
    message.includes("unauthorized")
  ) {
    return 401;
  }
  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

