import { Response } from "express";
import VideoAvatarService from "../services/videoAvatar.service";
import { getS3 } from "../services/s3";
import { SubscriptionService } from "../services/subscription.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  CreateVideoAvatarWithFilesRequest,
  VideoAvatarStatusResponse,
  AuthenticatedRequest,
} from "../types";
import {
  validateCreateVideoAvatar,
  validateAvatarIdParam,
  validateS3KeyParam,
} from "../validations/videoAvatar.validations";
import {
  getUserIdFromRequest,
  extractAccessToken,
  isValidUrl,
  cleanupTempFiles,
  validateFileNotEmpty,
  getErrorStatus,
  extractFilesFromRequest,
  validateFilesOrUrls,
  emitInitialNotification,
  emitFinalNotification,
  emitErrorNotification,
  tryGetMovSignedUrl,
} from "../utils/videoAvatarHelpers";
import { videoAvatarUploadMiddleware } from "../config/multer.videoAvatar.config";
import { SIGNED_URL_EXPIRY_SECONDS } from "../constants/videoAvatar.constants";

// ==================== SERVICE INSTANCE ====================
const videoAvatarService = new VideoAvatarService();

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
    const {
      avatar_name,
      avatar_group_id,
      callback_id,
      callback_url,
      training_footage_url,
      consent_statement_url,
    } = req.body;

    // Validate request body
    const validationResult = validateCreateVideoAvatar(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    // Get files from multer
    const files = extractFilesFromRequest(req);
    trainingFootageFile = files.trainingFootageFile;
    consentStatementFile = files.consentStatementFile;

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
    const filesValidation = validateFilesOrUrls(
      trainingFootageFile,
      training_footage_url,
      consentStatementFile,
      consent_statement_url
    );
    if (!filesValidation.isValid) {
      return ResponseHelper.badRequest(res, filesValidation.error!);
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
    emitInitialNotification(userId.toString(), avatar_name);

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
    emitFinalNotification(userId.toString(), result, avatar_name);

    return res.status(202).json(result);
  } catch (error: any) {
    console.error("Error in createVideoAvatar:", error);

    // Emit error socket notification
    const userId = req.user?._id;
    emitErrorNotification(
      userId?.toString(),
      req.body.avatar_name,
      error.message || "Internal server error"
    );

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
export const uploadMiddleware = videoAvatarUploadMiddleware;

/**
 * Check Video Avatar Generation Status
 * GET /v2/video_avatar/:id
 */
export async function getVideoAvatarStatus(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    // Validate avatar ID parameter
    const validationResult = validateAvatarIdParam(req.params);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { id } = validationResult.data!;

    const result: VideoAvatarStatusResponse =
      await videoAvatarService.getAvatarStatus(id);

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
    // Validate s3Key parameter
    const validationResult = validateS3KeyParam(req.params);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { s3Key } = validationResult.data!;
    const s3Service = getS3();
    let actualS3Key = decodeURIComponent(s3Key);

    // If the URL has .mp4 but the actual file is .mov, try the original .mov file first
    const movSignedUrl = await tryGetMovSignedUrl(s3Service, actualS3Key);
    if (movSignedUrl) {
      return res.redirect(movSignedUrl);
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
