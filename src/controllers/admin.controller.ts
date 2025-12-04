import { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import { AdminService } from "../services/admin/admin.service";
import { AuthenticatedRequest } from "../types";

const adminService = new AdminService();

// ==================== CONSTANTS ====================
const TEMP_DIR = "/tmp/";
const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1GB
const MAX_FIELD_SIZE = 1000 * 1024 * 1024; // 1GB
const MAX_FIELDS = 10;

// ==================== MULTER CONFIGURATION ====================
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

// Export multer middleware for single file upload
export const uploadPreviewVideoMiddleware = upload.single("preview_video");

/**
 * Get all users (admin only)
 * GET /api/v1/admin/users
 */
export async function getAllUsers(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be greater than 0",
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100",
      });
    }

    const result = await adminService.getAllUsers({
      page,
      limit,
      search,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Get all user avatar videos across all users (admin only)
 * GET /api/v1/admin/user-avatar-videos
 */
export async function getAllUserAvatarVideos(req: Request, res: Response) {
  try {
    const avatarVideos = await adminService.getAllUserAvatarVideos();

    return res.json({
      success: true,
      data: {
        avatarVideos,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Get user avatar videos for a specific user (admin only)
 * GET /api/v1/admin/user-avatar-videos/:userId
 */
export async function getUserAvatarVideos(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const avatarVideos = await adminService.getUserAvatarVideosByUserId(userId);

    return res.json({
      success: true,
      data: {
        avatarVideos,
      },
    });
  } catch (e: any) {
    if (e.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: e.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Create default avatar (admin only)
 * POST /api/v1/admin/default-avatars
 */
export async function createDefaultAvatar(req: Request, res: Response) {
  let previewVideoFile: Express.Multer.File | undefined;

  try {
    // Get file from multer
    previewVideoFile = (req as any).file as Express.Multer.File | undefined;

    // Validate required fields
    const { avatarId, avatarName, preview_image_url, userAvatarVideosId } = req.body;

    if (!avatarId || !avatarName || !preview_image_url) {
      cleanupTempFiles([previewVideoFile]);
      return res.status(400).json({
        success: false,
        message: "avatarId, avatarName, and preview_image_url are required",
      });
    }

    // Validate preview video file is provided
    if (!previewVideoFile) {
      return res.status(400).json({
        success: false,
        message: "preview_video file is required",
      });
    }

    // Validate file is not empty
    try {
      validateFileNotEmpty(previewVideoFile, "preview_video");
    } catch (error: any) {
      cleanupTempFiles([previewVideoFile]);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Create default avatar
    const avatar = await adminService.createDefaultAvatar({
      avatarId: avatarId.trim(),
      avatarName: avatarName.trim(),
      previewImageUrl: preview_image_url.trim(),
      previewVideo: previewVideoFile,
      userAvatarVideosId: userAvatarVideosId?.trim() || undefined,
    });

    // Clean up temporary file after successful upload
    cleanupTempFiles([previewVideoFile]);

    return res.status(201).json({
      success: true,
      message: "Default avatar created successfully",
      data: {
        avatar: {
          avatar_id: avatar.avatar_id,
          avatar_name: avatar.avatar_name,
          preview_image_url: avatar.preview_image_url,
          preview_video_url: avatar.preview_video_url,
          default: avatar.default,
          avatarType: (avatar as any).avatarType,
          status: avatar.status,
          userId: avatar.userId?.toString(),
          createdAt: avatar.createdAt,
          updatedAt: avatar.updatedAt,
        },
      },
    });
  } catch (e: any) {
    // Clean up temp file on error
    cleanupTempFiles([previewVideoFile]);

    if (e.message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        message: e.message,
      });
    }

    if (e.message === "UserAvatarVideos not found") {
      return res.status(404).json({
        success: false,
        message: e.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

