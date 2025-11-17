import crypto from "crypto";
import {
  AVATAR_ID_PREFIX,
  AVATAR_GROUP_ID_PREFIX,
  VALID_FILE_TYPES,
  VALID_VIDEO_AVATAR_STATUSES,
  VALID_UPDATE_AVATAR_STATUSES,
} from "../validations/videoAvatarService.validations";
import {
  FileType,
  AvatarStatus,
  UpdateAvatarStatus,
  NotificationPayload,
} from "../types/services/videoAvatar.types";

// ==================== ID GENERATION ====================
/**
 * Generate unique avatar ID
 */
export function generateAvatarId(): string {
  return `${AVATAR_ID_PREFIX}${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Generate unique avatar group ID
 */
export function generateAvatarGroupId(): string {
  return `${AVATAR_GROUP_ID_PREFIX}${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

// ==================== URL UTILITIES ====================
/**
 * Check if URL is an S3 URL
 */
export function isS3Url(url: string): boolean {
  return (
    /\.amazonaws\.com\//.test(url) ||
    (process.env.AWS_S3_BUCKET ? url.includes(process.env.AWS_S3_BUCKET) : false)
  );
}

/**
 * Extract S3 key from S3 URL
 */
export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // Remove leading slash and return the key
    return pathname.startsWith("/") ? pathname.slice(1) : pathname;
  } catch (error) {
    console.error("Error extracting S3 key from URL:", error);
    return null;
  }
}

// ==================== VALIDATION ====================
/**
 * Validate file type
 */
export function isValidFileType(fileType: string): fileType is FileType {
  return VALID_FILE_TYPES.includes(fileType as any);
}

/**
 * Validate avatar status
 */
export function isValidAvatarStatus(status: string): status is AvatarStatus {
  return VALID_VIDEO_AVATAR_STATUSES.includes(status as any);
}

/**
 * Validate update avatar status
 */
export function isValidUpdateAvatarStatus(
  status: string
): status is UpdateAvatarStatus {
  return VALID_UPDATE_AVATAR_STATUSES.includes(status as any);
}

/**
 * Validate HeyGen API configuration
 */
export function validateHeyGenConfig(): { valid: boolean; error?: string } {
  const baseUrl = process.env.HEYGEN_BASE_URL;
  const apiKey = process.env.HEYGEN_API_KEY;

  if (!baseUrl || !apiKey) {
    return {
      valid: false,
      error: "HEYGEN_BASE_URL and HEYGEN_API_KEY must be configured",
    };
  }

  return { valid: true };
}

// ==================== FILE UTILITIES ====================
/**
 * Sanitize filename for S3
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, "_");
}

/**
 * Generate S3 key for file
 */
export function generateS3Key(
  avatarId: string,
  fileType: FileType,
  filename: string
): string {
  const timestamp = Date.now();
  const safeFilename = sanitizeFilename(filename);
  return `video_avatars/${avatarId}/${fileType}/${timestamp}_${safeFilename}`;
}

// ==================== NOTIFICATION UTILITIES ====================
/**
 * Format notification payload
 */
export function formatNotificationPayload(
  avatarId: string,
  avatarName?: string,
  additionalData?: Partial<NotificationPayload>
): NotificationPayload {
  return {
    avatar_id: avatarId,
    avatar_name: avatarName,
    ...additionalData,
  };
}

