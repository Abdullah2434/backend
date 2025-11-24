import { Request } from "express";
import { AuthenticatedRequest } from "../types";
import { DEFAULT_POSTBACK_URL } from "../constants/socialbu.constants";

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
export function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.replace("Bearer ", "") || null;
}

/**
 * Normalize account IDs to numbers
 */
export function normalizeAccountIds(accountIds: (string | number)[]): number[] {
  return accountIds.map((id) => Number(id));
}

/**
 * Build user-specific postback URL
 */
export function buildUserPostbackUrl(
  userId: string,
  postbackUrl?: string
): string {
  const baseUrl = postbackUrl || DEFAULT_POSTBACK_URL;
  return `${baseUrl}?user_id=${userId}`;
}

/**
 * Determine HTTP status code based on error message
 */
export function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("token") ||
    message.includes("not authenticated") ||
    message.includes("user not found") ||
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

/**
 * Prepare request data for get posts endpoint
 */
export function prepareGetPostsRequestData(data: {
  type?: string;
  account_id?: string | number;
  limit?: string | number;
  offset?: string | number;
}): any {
  const requestData: any = {};
  if (data.type) requestData.type = data.type;
  if (data.account_id)
    requestData.account_id = parseInt(data.account_id as string);
  if (data.limit) requestData.limit = parseInt(data.limit as string);
  if (data.offset) requestData.offset = parseInt(data.offset as string);
  return requestData;
}

/**
 * Get user ID from authenticated request or validation data
 */
export function getUserIdFromAuthOrBody(
  req: AuthenticatedRequest,
  bodyUserId?: string
): string | null {
  return req.user?._id?.toString() || bodyUserId || null;
}

