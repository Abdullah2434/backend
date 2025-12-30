import { Request, Response } from "express";
import { MusicService } from "../services/music";
import { S3Service } from "../services/s3.service";
import { MusicPreviewService } from "../services/music/musicPreview.service";
import { AuthService } from "../services/auth.service";
import { extractAccessToken } from "../utils/controllerHelpers";
import multer from "multer";
import { MusicEnergyLevel } from "../constants/voiceEnergy";
import { ResponseHelper } from "../utils/responseHelper";
import { ValidationError } from "../types";
import {
  uploadMusicTrackSchema,
  getMusicTracksByEnergySchema,
  getMusicTrackByIdSchema,
  streamMusicPreviewSchema,
  deleteMusicTrackSchema,
  uploadCustomMusicTrackSchema,
} from "../validations/music.validations";
import { ZodError } from "zod";
import { CreateMusicTrackData, MusicTrackMetadata } from "../types/music.types";
import {
  MAX_FILE_SIZE,
  PREVIEW_URL_EXPIRATION,
  VALID_ENERGY_CATEGORIES,
  DEFAULT_AWS_REGION,
  AUDIO_MIME_TYPE_PREFIX,
} from "../constants/music.constants";

// ==================== HELPER FUNCTIONS ====================

/**
 * Format validation errors from Zod
 */
function formatValidationErrors(error: ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

/**
 * Extract S3 key from S3 URL
 */
function extractS3KeyFromUrl(s3Url: string): string {
  // Remove protocol and domain, keep only the path
  return s3Url.split("/").slice(3).join("/");
}

/**
 * Validate energy category
 */
function isValidEnergyCategory(category: string): category is MusicEnergyLevel {
  return VALID_ENERGY_CATEGORIES.includes(category as MusicEnergyLevel);
}

/**
 * Validate file exists
 */
function requireFile(
  file: Express.Multer.File | undefined
): Express.Multer.File {
  if (!file) {
    throw new Error("Audio file is required");
  }
  return file;
}

/**
 * Create S3 service configuration from environment
 */
function createS3Config() {
  return {
    region: process.env.AWS_REGION || DEFAULT_AWS_REGION,
    bucketName: process.env.AWS_S3_BUCKET || "",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  };
}

/**
 * Build music track creation data
 */
function buildMusicTrackData(
  validationData: any,
  file: Express.Multer.File
): CreateMusicTrackData {
  const metadata: MusicTrackMetadata = {
    artist: validationData.artist,
    source: validationData.source,
    license: validationData.license,
    genre: validationData.genre,
  };

  return {
    name: validationData.name,
    energyCategory: validationData.energyCategory as MusicEnergyLevel,
    duration: parseInt(validationData.duration),
    fullTrackBuffer: file.buffer,
    filename: file.originalname,
    contentType: file.mimetype,
    metadata: Object.keys(metadata).some(
      (key) => metadata[key as keyof MusicTrackMetadata]
    )
      ? metadata
      : undefined,
  };
}

// ==================== SERVICE INITIALIZATION ====================
const s3Service = new S3Service(createS3Config());
const musicService = new MusicService(s3Service);
const authService = new AuthService();

// ==================== MULTER CONFIGURATION ====================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith(AUDIO_MIME_TYPE_PREFIX)) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Upload music track (Admin endpoint)
 */
export async function uploadMusicTrack(req: Request, res: Response) {
  try {
    const file = requireFile(req.file);

    // Validate request body
    const validationResult = uploadMusicTrackSchema.safeParse(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const musicTrackData = buildMusicTrackData(validationResult.data, file);
    const musicTrack = await musicService.createMusicTrack(musicTrackData);

    return ResponseHelper.created(
      res,
      "Music track uploaded successfully",
      musicTrack
    );
  } catch (error: any) {
    console.error("Error in uploadMusicTrack:", error);

    if (error.message === "Audio file is required") {
      return ResponseHelper.badRequest(res, error.message);
    }

    return ResponseHelper.serverError(
      res,
      error.message || "Failed to upload music track",
      process.env.NODE_ENV === "development" ? error.stack : undefined
    );
  }
}

/**
 * Upload custom music track (automatically sets energyCategory to "custom")
 * Only requires the audio file - all other fields are optional
 * Requires authentication - associates track with user
 */
export async function uploadCustomMusicTrack(req: Request, res: Response) {
  try {
    const file = requireFile(req.file);

    // Require authentication for custom music upload
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return ResponseHelper.badRequest(
        res,
        "Authentication required. Please provide access token."
      );
    }

    const user = await authService.getCurrentUser(accessToken);
    if (!user) {
      return ResponseHelper.badRequest(
        res,
        "Invalid or expired access token"
      );
    }

    // Validate request body (all fields are optional for custom upload)
    const validationResult = uploadCustomMusicTrackSchema.safeParse(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    // Generate default name from filename if not provided
    const name = validationResult.data.name || 
      file.originalname.replace(/\.[^/.]+$/, "") || 
      "Custom Music Track";

    // Get duration from audio file if not provided
    let duration: number;
    if (validationResult.data.duration) {
      duration = parseInt(validationResult.data.duration);
    } else {
      // Use MusicPreviewService to get duration from buffer
      const previewService = new MusicPreviewService(s3Service);
      try {
        duration = await previewService.getAudioDuration(file.buffer);
      } catch (error: any) {
        return ResponseHelper.badRequest(
          res,
          `Failed to extract duration from audio file: ${error.message}`
        );
      }
    }

    // Build music track data with energyCategory set to "custom" and userId
    const musicTrackData: CreateMusicTrackData = {
      name,
      energyCategory: "custom",
      duration,
      fullTrackBuffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype,
      userId: user._id.toString(),
      metadata: validationResult.data.artist || 
                validationResult.data.genre || 
                validationResult.data.source || 
                validationResult.data.license
        ? {
            artist: validationResult.data.artist,
            genre: validationResult.data.genre,
            source: validationResult.data.source,
            license: validationResult.data.license,
          }
        : undefined,
    };

    const musicTrack = await musicService.createMusicTrack(musicTrackData);

    return ResponseHelper.created(
      res,
      "Custom music track uploaded successfully",
      musicTrack
    );
  } catch (error: any) {
    console.error("Error in uploadCustomMusicTrack:", error);

    if (error.message === "Audio file is required") {
      return ResponseHelper.badRequest(res, error.message);
    }

    return ResponseHelper.serverError(
      res,
      error.message || "Failed to upload custom music track",
      process.env.NODE_ENV === "development" ? error.stack : undefined
    );
  }
}

/**
 * Get all music tracks (with optional energy filter)
 * Returns default tracks + user's custom tracks if authenticated
 */
export async function getAllMusicTracks(req: Request, res: Response) {
  try {
    const { energyCategory } = req.query;

    // Validate energy category if provided
    if (energyCategory && !isValidEnergyCategory(energyCategory as string)) {
      return ResponseHelper.badRequest(
        res,
        `Invalid energy category. Must be one of: ${VALID_ENERGY_CATEGORIES.join(
          ", "
        )}`
      );
    }

    // Try to get userId from token (optional - for custom tracks)
    let userId: string | undefined;
    const accessToken = extractAccessToken(req);
    if (accessToken) {
      const user = await authService.getCurrentUser(accessToken);
      if (user) {
        userId = user._id.toString();
      }
    }

    const tracks = await musicService.getAllMusicTracks(
      energyCategory as MusicEnergyLevel | undefined,
      userId
    );

    return ResponseHelper.success(
      res,
      "Music tracks retrieved successfully",
      tracks
    );
  } catch (error: any) {
    console.error("Error in getAllMusicTracks:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to get music tracks"
    );
  }
}

/**
 * Get music tracks by energy category
 * For custom tracks, requires authentication and returns only user's tracks
 */
export async function getMusicTracksByEnergy(req: Request, res: Response) {
  try {
    const { energyCategory } = req.params;

    // Validate energy category
    const validationResult = getMusicTracksByEnergySchema.safeParse({
      energyCategory,
    });
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const category = validationResult.data.energyCategory as MusicEnergyLevel;

    // For custom tracks, require authentication
    let userId: string | undefined;
    if (category === "custom") {
      const accessToken = extractAccessToken(req);
      if (!accessToken) {
        return ResponseHelper.badRequest(
          res,
          "Authentication required to access custom music tracks"
        );
      }
      const user = await authService.getCurrentUser(accessToken);
      if (!user) {
        return ResponseHelper.badRequest(
          res,
          "Invalid or expired access token"
        );
      }
      userId = user._id.toString();
    }

    const tracks = await musicService.getMusicTracksByEnergy(
      category,
      userId
    );

    return ResponseHelper.success(
      res,
      `Music tracks for ${category} energy retrieved successfully`,
      tracks
    );
  } catch (error: any) {
    console.error("Error in getMusicTracksByEnergy:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to get music tracks"
    );
  }
}

/**
 * Get specific music track details
 */
export async function getMusicTrackById(req: Request, res: Response) {
  try {
    const { trackId } = req.params;

    // Validate trackId
    const validationResult = getMusicTrackByIdSchema.safeParse({ trackId });
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const track = await musicService.getMusicTrackWithUrls(
      validationResult.data.trackId
    );
    if (!track) {
      return ResponseHelper.notFound(res, "Music track not found");
    }

    return ResponseHelper.success(
      res,
      "Music track retrieved successfully",
      track
    );
  } catch (error: any) {
    console.error("Error in getMusicTrackById:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to get music track"
    );
  }
}

/**
 * Stream music track preview
 */
export async function streamMusicPreview(req: Request, res: Response) {
  try {
    const { trackId } = req.params;

    // Validate trackId
    const validationResult = streamMusicPreviewSchema.safeParse({ trackId });
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const track = await musicService.getMusicTrackById(
      validationResult.data.trackId
    );
    if (!track) {
      return ResponseHelper.notFound(res, "Music track not found");
    }

    // Generate fresh signed URL for preview
    const s3Key = extractS3KeyFromUrl(track.s3PreviewUrl);
    const previewUrl = await s3Service.getMusicTrackUrl(
      s3Key,
      PREVIEW_URL_EXPIRATION
    );

    // Redirect to S3 URL for streaming
    return res.redirect(previewUrl);
  } catch (error: any) {
    console.error("Error in streamMusicPreview:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to stream music preview"
    );
  }
}

/**
 * Delete music track (Admin endpoint)
 */
export async function deleteMusicTrack(req: Request, res: Response) {
  try {
    const { trackId } = req.params;

    // Validate trackId
    const validationResult = deleteMusicTrackSchema.safeParse({ trackId });
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const success = await musicService.deleteMusicTrack(
      validationResult.data.trackId
    );
    if (!success) {
      return ResponseHelper.notFound(res, "Music track not found");
    }

    return ResponseHelper.success(res, "Music track deleted successfully");
  } catch (error: any) {
    console.error("Error in deleteMusicTrack:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to delete music track"
    );
  }
}

/**
 * Get music tracks statistics
 * Includes user's custom tracks count if authenticated
 */
export async function getMusicTracksStats(req: Request, res: Response) {
  try {
    // Try to get userId from token (optional - for custom tracks count)
    let userId: string | undefined;
    const accessToken = extractAccessToken(req);
    if (accessToken) {
      const user = await authService.getCurrentUser(accessToken);
      if (user) {
        userId = user._id.toString();
      }
    }

    const stats = await musicService.getMusicTracksCount(userId);

    return ResponseHelper.success(
      res,
      "Music tracks statistics retrieved successfully",
      stats
    );
  } catch (error: any) {
    console.error("Error in getMusicTracksStats:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to get music tracks statistics"
    );
  }
}

// Export multer middleware for use in routes
export { upload };
