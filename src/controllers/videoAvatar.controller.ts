import { Response } from "express";
import multer from "multer";
import fs from "fs";
import { VideoAvatarService } from "../services/video";
import { getS3 } from "../services/s3.service";
import { notificationService } from "../services/notification.service";
import { SubscriptionService } from "../services/payment";
import { ResponseHelper } from "../utils/responseHelper";
import {
  CreateVideoAvatarWithFilesRequest,
  VideoAvatarStatusResponse,
  AuthenticatedRequest,
} from "../types";
import {
  createVideoAvatarSchema,
  avatarIdParamSchema,
  s3KeyParamSchema,
} from "../validations/videoAvatar.validations";

// ==================== CONSTANTS ====================
const TEMP_DIR = "/tmp/";
const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1GB
const MAX_FIELD_SIZE = 1000 * 1024 * 1024; // 1GB
const MAX_FILES = 10;
const MAX_FIELDS = 20;
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

const TEMP_AVATAR_ID = "temp-avatar-id";

// Socket notification statuses
const NOTIFICATION_STATUSES = {
  VALIDATION: "validation",
  PROGRESS: "progress",
  COMPLETED: "completed",
  ERROR: "error",
  FINAL_RESULT: "final_result",
} as const;

// ==================== SERVICE INSTANCE ====================
const videoAvatarService = new VideoAvatarService();

// ==================== MULTER CONFIGURATION ====================
// Configure multer for file uploads with streaming to avoid memory issues
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
    fieldSize: MAX_FIELD_SIZE,
    files: MAX_FILES,
    fields: MAX_FIELDS,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed") as any);
    }
  },
});

// ==================== HELPER FUNCTIONS ====================
/**
 * Get user ID from authenticated request
 */
function getUserIdFromRequest(req: AuthenticatedRequest): string {
  if (!req.user?._id) {
    throw new Error("User not authenticated");
  }
  return req.user._id.toString();
}

/**
 * Extract access token from request headers
 */
function extractAccessToken(req: AuthenticatedRequest): string | undefined {
  return req.headers.authorization?.replace("Bearer ", "");
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
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
function cleanupTempFiles(files: (Express.Multer.File | undefined)[]): void {
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
function validateFileNotEmpty(
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
function getFinalNotificationStatus(
  status: string | undefined
): "completed" | "error" | "progress" {
  if (status === "completed") return "completed";
  if (status === "failed") return "error";
  return "progress";
}

/**
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
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

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Submit Video Avatar Creation Request (with file uploads)
 * POST /v2/video_avatar
 */
export async function createVideoAvatar(
  req: AuthenticatedRequest,
  res: Response
) {
  let trainingFootageFile: Express.Multer.File | undefined;
  let consentStatementFile: Express.Multer.File | undefined;

  try {
    const rawFiles: any = (req as any).files || {};
    const {
      avatar_name,
      avatar_group_id,
      callback_id,
      callback_url,
      training_footage_url,
      consent_statement_url,
    } = req.body;

    // Validate request body
    const validationResult = createVideoAvatarSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    // Get files from multer
    trainingFootageFile =
      (rawFiles?.training_footage?.[0] as Express.Multer.File) || undefined;
    consentStatementFile =
      (rawFiles?.consent_statement?.[0] as Express.Multer.File) || undefined;

    // Get user ID and token
    const userId = req.user?._id;
    const authToken = extractAccessToken(req);

    if (!userId) {
      return ResponseHelper.unauthorized(
        res,
        "Authentication required. User ID not found in request."
      );
    }

    // Check for active subscription
    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getActiveSubscription(
      userId.toString()
    );
    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required to create video avatars",
      });
    }

    // Validate files or URLs are provided
    if (!trainingFootageFile && !training_footage_url) {
      return ResponseHelper.badRequest(
        res,
        "Either training_footage file or training_footage_url is required"
      );
    }

    if (!consentStatementFile && !consent_statement_url) {
      return ResponseHelper.badRequest(
        res,
        "Either consent_statement file or consent_statement_url is required"
      );
    }

    // Validate files are not empty
    try {
      validateFileNotEmpty(trainingFootageFile, "training_footage");
      validateFileNotEmpty(consentStatementFile, "consent_statement");
    } catch (error: any) {
      return ResponseHelper.badRequest(res, error.message);
    }

    // Validate callback URL if provided
    if (callback_url && !isValidUrl(callback_url)) {
      return ResponseHelper.badRequest(res, "Invalid callback_url format");
    }

    // Emit initial socket notification
    notificationService.notifyVideoAvatarProgress(
      userId,
      TEMP_AVATAR_ID,
      NOTIFICATION_STATUSES.VALIDATION,
      NOTIFICATION_STATUSES.PROGRESS,
      {
        avatar_name,
        message: "Validating files and preparing avatar creation...",
      }
    );

    // Create video avatar
    const request: CreateVideoAvatarWithFilesRequest = {
      avatar_name,
      avatar_group_id,
      callback_id,
      callback_url,
      training_footage_file: trainingFootageFile,
      consent_statement_file: consentStatementFile,
    };

    const result = await videoAvatarService.createVideoAvatarWithFiles(
      request,
      {
        training_footage_url: training_footage_url,
        consent_statement_url: consent_statement_url,
      },
      userId,
      authToken || undefined
    );

    // Clean up temporary files after successful upload
    cleanupTempFiles([trainingFootageFile, consentStatementFile]);

    // Emit final socket notification
    const finalStatus = getFinalNotificationStatus(result.status);
    notificationService.notifyVideoAvatarProgress(
      userId,
      result.avatar_id,
      NOTIFICATION_STATUSES.FINAL_RESULT,
      finalStatus,
      {
        avatar_name: result.avatar_name || avatar_name,
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

    return res.status(202).json(result);
  } catch (error: any) {
    console.error("Error in createVideoAvatar:", error);

    // Emit error socket notification
    const userId = req.user?._id;
    if (userId) {
      notificationService.notifyVideoAvatarProgress(
        userId,
        TEMP_AVATAR_ID,
        NOTIFICATION_STATUSES.ERROR,
        NOTIFICATION_STATUSES.ERROR,
        {
          avatar_name: req.body.avatar_name,
          error: error.message || "Internal server error",
          message: "Failed to create video avatar",
        }
      );
    }

    // Clean up temporary files on error
    cleanupTempFiles([trainingFootageFile, consentStatementFile]);

    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * Multer middleware for file uploads
 */
export const uploadMiddleware = (req: any, res: any, next: any) => {
  const mw = upload.fields([
    { name: "training_footage", maxCount: 1 },
    { name: "consent_statement", maxCount: 1 },
  ]);
  mw(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: "Upload error",
        error: String(err),
      });
    }
    next();
  });
};

/**
 * Check Video Avatar Generation Status
 * GET /v2/video_avatar/:id
 */
export async function getVideoAvatarStatus(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    // Validate avatar ID parameter
    const validationResult = avatarIdParamSchema.safeParse({ id });
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const result: VideoAvatarStatusResponse =
      await videoAvatarService.getAvatarStatus(validationResult.data.id);

    return ResponseHelper.success(
      res,
      "Avatar status retrieved successfully",
      result
    );
  } catch (error: any) {
    console.error("Error in getVideoAvatarStatus:", error);

    if (error.message === "Avatar ID not found") {
      return ResponseHelper.notFound(res, "Avatar ID not found");
    }

    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * Health check endpoint for video avatar service
 * GET /v2/video_avatar/health
 */
export async function healthCheck(req: AuthenticatedRequest, res: Response) {
  try {
    return ResponseHelper.success(res, "Video Avatar service is healthy", {
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in healthCheck:", error);
    return ResponseHelper.serverError(
      res,
      "Video Avatar service is unhealthy",
      error.message
    );
  }
}

/**
 * Proxy endpoint to serve video avatar files with clean URLs
 * GET /v2/video_avatar/proxy/:s3Key
 */
export async function proxyVideoFile(req: AuthenticatedRequest, res: Response) {
  try {
    const { s3Key } = req.params;

    // Validate s3Key parameter
    const validationResult = s3KeyParamSchema.safeParse({ s3Key });
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const s3Service = getS3();
    let actualS3Key = decodeURIComponent(validationResult.data.s3Key);

    // If the URL has .mp4 but the actual file is .mov, try the original .mov file first
    if (actualS3Key.endsWith(".mp4")) {
      const movS3Key = actualS3Key.replace(/\.mp4$/i, ".mov");
      try {
        const signedUrl = await s3Service.getSignedVideoUrl(
          movS3Key,
          SIGNED_URL_EXPIRY_SECONDS
        );
        return res.redirect(signedUrl);
      } catch (error) {
        // If .mov doesn't exist, try the .mp4 version
      }
    }

    // Generate a signed URL for the S3 object
    const signedUrl = await s3Service.getSignedVideoUrl(
      actualS3Key,
      SIGNED_URL_EXPIRY_SECONDS
    );

    // Redirect to the signed URL
    return res.redirect(signedUrl);
  } catch (error: any) {
    console.error("Error in proxyVideoFile:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to serve video file",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
