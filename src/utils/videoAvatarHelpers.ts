import fs from "fs";
import { AuthenticatedRequest } from "../types";
import { notificationService } from "../services/notification.service";
import {
  TEMP_AVATAR_ID,
  NOTIFICATION_STATUSES,
  SIGNED_URL_EXPIRY_SECONDS,
} from "../constants/videoAvatar.constants";
import {
  FileType,
  UpdateAvatarStatus,
  NotificationPayload,
} from "../types/services/videoAvatar.types";
import {
  AVATAR_ID_PREFIX,
  AVATAR_GROUP_ID_PREFIX,
  VALID_FILE_TYPES,
  VALID_UPDATE_AVATAR_STATUSES,
} from "../validations/videoAvatarService.validations";

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
export function extractAccessToken(req: AuthenticatedRequest): string | undefined {
  return req.headers.authorization?.replace("Bearer ", "");
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean up temporary files
 */
export function cleanupTempFiles(
  files: (Express.Multer.File | undefined)[]
): void {
  files.forEach((file) => {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (error) {
        console.warn(`Failed to clean up temp file ${file.path}:`, error);
      }
    }
  });
}

/**
 * Validate file is not empty
 */
export function validateFileNotEmpty(
  file: Express.Multer.File | undefined,
  fieldName: string
): void {
  if (file && (!file.path || file.size === 0)) {
    throw new Error(`Empty ${fieldName} file`);
  }
}

/**
 * Get final notification status from result status
 */
export function getFinalNotificationStatus(
  status: string | undefined
): "completed" | "error" | "progress" {
  if (status === "completed") return "completed";
  if (status === "failed") return "error";
  return "progress";
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
  if (message.includes("subscription")) {
    return 403;
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
 * Extract files from multer request
 */
export function extractFilesFromRequest(req: any): {
  trainingFootageFile?: Express.Multer.File;
  consentStatementFile?: Express.Multer.File;
} {
  const rawFiles: any = req.files || {};
  return {
    trainingFootageFile:
      (rawFiles?.training_footage?.[0] as Express.Multer.File) || undefined,
    consentStatementFile:
      (rawFiles?.consent_statement?.[0] as Express.Multer.File) || undefined,
  };
}

/**
 * Validate files or URLs are provided
 */
export function validateFilesOrUrls(
  trainingFootageFile: Express.Multer.File | undefined,
  trainingFootageUrl: string | undefined,
  consentStatementFile: Express.Multer.File | undefined,
  consentStatementUrl: string | undefined
): { isValid: boolean; error?: string } {
  if (!trainingFootageFile && !trainingFootageUrl) {
    return {
      isValid: false,
      error: "Either training_footage file or training_footage_url is required",
    };
  }

  if (!consentStatementFile && !consentStatementUrl) {
    return {
      isValid: false,
      error:
        "Either consent_statement file or consent_statement_url is required",
    };
  }

  return { isValid: true };
}

/**
 * Emit initial validation notification
 */
export function emitInitialNotification(
  userId: string,
  avatarName: string
): void {
  notificationService.notifyVideoAvatarProgress(
    userId,
    TEMP_AVATAR_ID,
    NOTIFICATION_STATUSES.VALIDATION,
    NOTIFICATION_STATUSES.PROGRESS,
    {
      avatar_name: avatarName,
      message: "Validating files and preparing avatar creation...",
    }
  );
}

/**
 * Emit final result notification
 */
export function emitFinalNotification(
  userId: string,
  result: any,
  avatarName: string
): void {
  const finalStatus = getFinalNotificationStatus(result.status);
  notificationService.notifyVideoAvatarProgress(
    userId,
    result.avatar_id,
    NOTIFICATION_STATUSES.FINAL_RESULT,
    finalStatus,
    {
      avatar_name: result.avatar_name || avatarName,
      avatar_id: result.avatar_id,
      avatar_group_id: result.avatar_group_id,
      status: result.status,
      message: result.message,
      preview_image_url: result.preview_image_url,
      preview_video_url: result.preview_video_url,
      default_voice_id: result.default_voice_id,
      error: result.error,
    }
  );
}

/**
 * Emit error notification
 */
export function emitErrorNotification(
  userId: string | undefined,
  avatarName: string | undefined,
  errorMessage: string
): void {
  if (userId) {
    notificationService.notifyVideoAvatarProgress(
      userId,
      TEMP_AVATAR_ID,
      NOTIFICATION_STATUSES.ERROR,
      NOTIFICATION_STATUSES.ERROR,
      {
        avatar_name: avatarName,
        error: errorMessage,
        message: "Failed to create video avatar",
      }
    );
  }
}

/**
 * Try to get signed URL for .mov file if .mp4 is requested
 */
export async function tryGetMovSignedUrl(
  s3Service: any,
  s3Key: string
): Promise<string | null> {
  if (s3Key.endsWith(".mp4")) {
    const movS3Key = s3Key.replace(/\.mp4$/i, ".mov");
    try {
      return await s3Service.getSignedVideoUrl(
        movS3Key,
        SIGNED_URL_EXPIRY_SECONDS
      );
    } catch (error) {
      // If .mov doesn't exist, return null to try .mp4 version
      return null;
    }
  }
  return null;
}

// ==================== SERVICE-LEVEL UTILITY FUNCTIONS ====================

/**
 * Generate unique avatar ID
 */
export function generateAvatarId(): string {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  return `${AVATAR_ID_PREFIX}${timestamp}_${random}`;
}

/**
 * Generate unique avatar group ID
 */
export function generateAvatarGroupId(): string {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  return `${AVATAR_GROUP_ID_PREFIX}${timestamp}_${random}`;
}

/**
 * Check if URL is an S3 URL
 */
export function isS3Url(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return (
    url.includes("s3://") ||
    url.includes("amazonaws.com") ||
    url.includes("s3.")
  );
}

/**
 * Extract S3 key from URL
 */
export function extractS3KeyFromUrl(url: string): string | null {
  if (!isS3Url(url)) return null;

  try {
    // Handle s3:// URLs
    if (url.startsWith("s3://")) {
      const parts = url.replace("s3://", "").split("/");
      if (parts.length > 1) {
        return parts.slice(1).join("/");
      }
    }

    // Handle https:// URLs
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // Remove leading slash and bucket name if present
    const parts = pathname.split("/").filter((p) => p);
    if (parts.length > 1) {
      return parts.slice(1).join("/");
    }
    return parts[0] || null;
  } catch (error) {
    console.error("Error extracting S3 key from URL:", error);
    return null;
  }
}

/**
 * Validate HeyGen configuration
 */
export function validateHeyGenConfig(): {
  valid: boolean;
  error?: string;
} {
  const baseUrl = process.env.HEYGEN_BASE_URL;
  const apiKey = process.env.HEYGEN_API_KEY;

  if (!baseUrl) {
    return {
      valid: false,
      error: "HEYGEN_BASE_URL environment variable is not set",
    };
  }

  if (!apiKey) {
    return {
      valid: false,
      error: "HEYGEN_API_KEY environment variable is not set",
    };
  }

  return { valid: true };
}

/**
 * Validate file type
 */
export function isValidFileType(fileType: string): fileType is FileType {
  return VALID_FILE_TYPES.includes(fileType as FileType);
}

/**
 * Validate update avatar status
 */
export function isValidUpdateAvatarStatus(
  status: string
): status is UpdateAvatarStatus {
  return VALID_UPDATE_AVATAR_STATUSES.includes(status as UpdateAvatarStatus);
}

/**
 * Generate S3 key for avatar file
 */
export function generateS3Key(
  avatarId: string,
  fileType: FileType,
  filename?: string
): string {
  const timestamp = Date.now();
  const extension = filename
    ? filename.split(".").pop() || "mp4"
    : fileType === "training_footage"
    ? "mp4"
    : "pdf";

  return `video_avatars/${avatarId}/${fileType}_${timestamp}.${extension}`;
}

/**
 * Format notification payload
 */
export function formatNotificationPayload(
  avatarId: string,
  avatarName: string | undefined,
  additionalData: any = {}
): NotificationPayload {
  return {
    avatar_id: avatarId,
    avatar_name: avatarName,
    ...additionalData,
  };
}
