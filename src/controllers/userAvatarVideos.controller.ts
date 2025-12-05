import { Response } from "express";
import multer from "multer";
import fs from "fs";
import { UserAvatarVideosService } from "../services/user/userAvatarVideos.service";
import { ResponseHelper } from "../utils/responseHelper";
import { AuthenticatedRequest } from "../types";
import { uploadAvatarVideosSchema } from "../validations/userAvatarVideos.validations";
import {
  formatValidationErrors,
  handleControllerError,
  getUserIdFromRequest,
} from "../utils/controllerHelpers";
import { sendAvatarVideoUploadNotification } from "../services/email.service";
import User from "../models/User";

// ==================== CONSTANTS ====================
const TEMP_DIR = "/tmp/";
const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1GB
const MAX_FIELD_SIZE = 1000 * 1024 * 1024; // 1GB
const MAX_FILES = 2;
const MAX_FIELDS = 10;

// ==================== SERVICE INSTANCE ====================
const userAvatarVideosService = new UserAvatarVideosService();

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

// ==================== MULTER MIDDLEWARE ====================
/**
 * Multer middleware for handling file uploads
 */
export const uploadAvatarVideosMiddleware = (req: any, res: any, next: any) => {
  const mw = upload.fields([
    { name: "consentVideo", maxCount: 1 },
    { name: "trainingVideo", maxCount: 1 },
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

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Upload Avatar Videos
 * POST /api/v1/user/avatar-videos
 */
export async function uploadAvatarVideos(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> {
  let consentVideoFile: Express.Multer.File | undefined;
  let trainingVideoFile: Express.Multer.File | undefined;

  try {
    // Get user ID from authenticated request
    const userId = getUserIdFromRequest(req);

    // Get files from multer
    const rawFiles: any = (req as any).files || {};
    consentVideoFile =
      (rawFiles?.consentVideo?.[0] as Express.Multer.File) || undefined;
    trainingVideoFile =
      (rawFiles?.trainingVideo?.[0] as Express.Multer.File) || undefined;

    // Validate at least one file is provided
    if (!consentVideoFile && !trainingVideoFile) {
      return ResponseHelper.badRequest(
        res,
        "At least one video file (consentVideo or trainingVideo) is required"
      );
    }

    // Validate files are not empty
    if (consentVideoFile) {
      validateFileNotEmpty(consentVideoFile, "consentVideo");
    }
    if (trainingVideoFile) {
      validateFileNotEmpty(trainingVideoFile, "trainingVideo");
    }

    // Validate request body
    const validationResult = uploadAvatarVideosSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      cleanupTempFiles([consentVideoFile, trainingVideoFile]);
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { isAvatarCreated } = validationResult.data;

    // Upload videos to S3 and save to database
    const record = await userAvatarVideosService.uploadAvatarVideos(
      userId,
      {
        consentVideo: consentVideoFile,
        trainingVideo: trainingVideoFile,
      },
      isAvatarCreated
    );

    // Generate preview links for email notification
    let consentVideoPreviewLink: string | null = null;
    let trainingVideoPreviewLink: string | null = null;

    if (record.consentVideoS3Key) {
      try {
        consentVideoPreviewLink = await userAvatarVideosService.generateAdminPreviewUrl(
          record.consentVideoS3Key
        );
      } catch (error) {
        console.error("Error generating consent video preview link:", error);
      }
    }

    if (record.trainingVideoS3Key) {
      try {
        trainingVideoPreviewLink = await userAvatarVideosService.generateAdminPreviewUrl(
          record.trainingVideoS3Key
        );
      } catch (error) {
        console.error("Error generating training video preview link:", error);
      }
    }

    // Get user information for email
    let userName: string = userId; // Default to userId if user not found
    try {
      const user = await User.findById(userId).select("firstName lastName");
      if (user) {
        userName = `${user.firstName} ${user.lastName}`.trim() || userId;
      }
    } catch (error) {
      console.error("Error fetching user information:", error);
    }

    // Send email notification to admin
    try {
      await sendAvatarVideoUploadNotification(
        "Shawheendn@gmail.com",
        userId,
        userName,
        consentVideoPreviewLink,
        trainingVideoPreviewLink
      );
    } catch (emailError) {
      // Log error but don't fail the request if email fails
      console.error("Failed to send avatar video upload notification email:", emailError);
    }

    // Clean up temporary files after successful upload
    cleanupTempFiles([consentVideoFile, trainingVideoFile]);

    // Generate signed URLs for response
    let consentVideoUrl: string | null = null;
    let trainingVideoUrl: string | null = null;

    if (record.consentVideoS3Key) {
      try {
        consentVideoUrl = await userAvatarVideosService.generateAdminPreviewUrl(
          record.consentVideoS3Key
        );
      } catch (error) {
        console.error("Error generating consent video URL:", error);
      }
    }

    if (record.trainingVideoS3Key) {
      try {
        trainingVideoUrl = await userAvatarVideosService.generateAdminPreviewUrl(
          record.trainingVideoS3Key
        );
      } catch (error) {
        console.error("Error generating training video URL:", error);
      }
    }

    return ResponseHelper.success(
      res,
      "Avatar videos uploaded successfully",
      {
        id: record._id.toString(),
        userId: record.userId.toString(),
        consentVideoS3Key: record.consentVideoS3Key || null,
        trainingVideoS3Key: record.trainingVideoS3Key || null,
        consentVideoUrl,
        trainingVideoUrl,
        isAvatarCreated: record.isAvatarCreated,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }
    );
  } catch (error: any) {
    // Clean up temporary files on error
    cleanupTempFiles([consentVideoFile, trainingVideoFile]);
    return handleControllerError(
      error,
      res,
      "uploadAvatarVideos",
      "Failed to upload avatar videos"
    );
  }
}

/**
 * Get All User Avatar Videos
 * GET /api/v1/user/avatar-videos
 */
export async function getUserAvatarVideos(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> {
  try {
    const userId = getUserIdFromRequest(req);

    const records = await userAvatarVideosService.getUserAvatarVideos(userId);

    // Generate signed URLs for each record
    const recordsWithUrls = await Promise.all(
      records.map(async (record) => {
        let consentVideoUrl: string | null = null;
        let trainingVideoUrl: string | null = null;

        if (record.consentVideoS3Key) {
          try {
            consentVideoUrl = await userAvatarVideosService.generateAdminPreviewUrl(
              record.consentVideoS3Key
            );
          } catch (error) {
            console.error("Error generating consent video URL:", error);
          }
        }

        if (record.trainingVideoS3Key) {
          try {
            trainingVideoUrl = await userAvatarVideosService.generateAdminPreviewUrl(
              record.trainingVideoS3Key
            );
          } catch (error) {
            console.error("Error generating training video URL:", error);
          }
        }

        return {
          id: record._id.toString(),
          userId: record.userId.toString(),
          consentVideoS3Key: record.consentVideoS3Key || null,
          trainingVideoS3Key: record.trainingVideoS3Key || null,
          consentVideoUrl,
          trainingVideoUrl,
          isAvatarCreated: record.isAvatarCreated,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
      })
    );

    return ResponseHelper.success(
      res,
      "Avatar videos retrieved successfully",
      recordsWithUrls
    );
  } catch (error: any) {
    return handleControllerError(
      error,
      res,
      "getUserAvatarVideos",
      "Failed to retrieve avatar videos"
    );
  }
}

/**
 * Get Specific User Avatar Video by ID
 * GET /api/v1/user/avatar-videos/:id
 */
export async function getUserAvatarVideoById(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    if (!id) {
      return ResponseHelper.badRequest(res, "Record ID is required");
    }

    const record = await userAvatarVideosService.getUserAvatarVideoById(
      userId,
      id
    );

    if (!record) {
      return ResponseHelper.notFound(
        res,
        "Avatar video record not found or access denied"
      );
    }

    // Generate signed URLs for response
    let consentVideoUrl: string | null = null;
    let trainingVideoUrl: string | null = null;

    if (record.consentVideoS3Key) {
      try {
        consentVideoUrl = await userAvatarVideosService.generateAdminPreviewUrl(
          record.consentVideoS3Key
        );
      } catch (error) {
        console.error("Error generating consent video URL:", error);
      }
    }

    if (record.trainingVideoS3Key) {
      try {
        trainingVideoUrl = await userAvatarVideosService.generateAdminPreviewUrl(
          record.trainingVideoS3Key
        );
      } catch (error) {
        console.error("Error generating training video URL:", error);
      }
    }

    return ResponseHelper.success(res, "Avatar video retrieved successfully", {
      id: record._id.toString(),
      userId: record.userId.toString(),
      consentVideoS3Key: record.consentVideoS3Key || null,
      trainingVideoS3Key: record.trainingVideoS3Key || null,
      consentVideoUrl,
      trainingVideoUrl,
      isAvatarCreated: record.isAvatarCreated,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  } catch (error: any) {
    return handleControllerError(
      error,
      res,
      "getUserAvatarVideoById",
      "Failed to retrieve avatar video"
    );
  }
}

