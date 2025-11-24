import { AuthenticatedRequest } from "../types";
import { ACCOUNT_TYPE_CAPTION_MAP } from "../constants/socialbuMedia.constants";

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
 * Normalize accountIds to array format
 */
export function normalizeAccountIds(accountIds: any): number[] {
  if (typeof accountIds === "string") {
    try {
      const parsed = JSON.parse(accountIds);
      return Array.isArray(parsed) ? parsed : [parseInt(accountIds)];
    } catch (e) {
      return [parseInt(accountIds)];
    }
  } else if (typeof accountIds === "number") {
    return [accountIds];
  } else if (
    typeof accountIds === "object" &&
    accountIds !== null &&
    !Array.isArray(accountIds)
  ) {
    return Object.values(accountIds).filter(
      (val) => typeof val === "number"
    ) as number[];
  }
  return Array.isArray(accountIds) ? accountIds : [];
}

/**
 * Normalize selectedAccounts to array format
 */
export function normalizeSelectedAccounts(selectedAccounts: any): any[] {
  if (
    selectedAccounts &&
    typeof selectedAccounts === "object" &&
    !Array.isArray(selectedAccounts)
  ) {
    return Object.values(selectedAccounts);
  }
  return Array.isArray(selectedAccounts) ? selectedAccounts : [];
}

/**
 * Get appropriate caption for account type
 */
export function getAccountCaption(
  account: any,
  captions: {
    caption?: string;
    instagram_caption?: string;
    facebook_caption?: string;
    linkedin_caption?: string;
    twitter_caption?: string;
    tiktok_caption?: string;
    youtube_caption?: string;
  }
): string {
  const accountType = account.type;
  const captionKey = ACCOUNT_TYPE_CAPTION_MAP[accountType];

  // Check for specific account type caption
  if (captionKey && captions[captionKey as keyof typeof captions]) {
    return (
      captions[captionKey as keyof typeof captions] || captions.caption || ""
    );
  }

  // Check for facebook.* pattern
  if (accountType?.startsWith("facebook.") && captions.facebook_caption) {
    return captions.facebook_caption;
  }

  // Default to main caption
  return captions.caption || "";
}

/**
 * Format media response data
 */
export function formatMediaResponse(data: any) {
  return {
    id: data?._id,
    userId: data?.userId,
    name: data?.name,
    mime_type: data?.mime_type,
    socialbuResponse: data?.socialbuResponse,
    uploadScript: data?.uploadScript,
    status: data?.status,
    errorMessage: data?.errorMessage,
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
  };
}

/**
 * Determine HTTP status code based on error message
 */
export function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("token") ||
    message.includes("not authenticated") ||
    message.includes("user not found")
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

