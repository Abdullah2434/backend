import { Request, Response } from "express";
import { MusicService } from "../services/music.service";
import { S3Service } from "../services/s3";
import { MusicEnergyLevel } from "../constants/voiceEnergy";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateUploadMusicTrack,
  validateGetAllMusicTracksQuery,
  validateGetMusicTracksByEnergy,
  validateGetMusicTrackById,
  validateStreamMusicPreview,
  validateDeleteMusicTrack,
} from "../validations/music.validations";
import { extractS3KeyFromUrl } from "../utils/musicHelpers";
import { PREVIEW_URL_EXPIRATION } from "../constants/music.constants";
import { musicUpload } from "../config/multer.config";

// ==================== SERVICE INITIALIZATION ====================
const s3Service = new S3Service({
  region: process.env.AWS_REGION || "us-east-1",
  bucketName: process.env.AWS_S3_BUCKET || "",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
});
const musicService = new MusicService(s3Service);

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Upload music track (Admin endpoint)
 */
export async function uploadMusicTrack(req: Request, res: Response) {
  try {
    const file = req.file;

    if (!file) {
      return ResponseHelper.badRequest(res, "Audio file is required");
    }

    // Validate request body
    const validationResult = validateUploadMusicTrack(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { name, energyCategory, duration, artist, source, license, genre } =
      validationResult.data!;

    // Create music track
    const musicTrack = await musicService.createMusicTrack({
      name,
      energyCategory: energyCategory as MusicEnergyLevel,
      duration: parseInt(duration),
      fullTrackBuffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype,
      metadata: {
        artist,
        source,
        license,
        genre,
      },
    });

    return ResponseHelper.created(
      res,
      "Music track uploaded successfully",
      musicTrack
    );
  } catch (error: any) {
    console.error("Error in uploadMusicTrack:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to upload music track",
      process.env.NODE_ENV === "development" ? error.stack : undefined
    );
  }
}

/**
 * Get all music tracks (with optional energy filter)
 */
export async function getAllMusicTracks(req: Request, res: Response) {
  try {
    // Validate query parameters
    const validationResult = validateGetAllMusicTracksQuery(req.query);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { energyCategory } = validationResult.data || {};

    const tracks = await musicService.getAllMusicTracks(
      energyCategory as MusicEnergyLevel | undefined
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
 */
export async function getMusicTracksByEnergy(req: Request, res: Response) {
  try {
    // Validate route parameters
    const validationResult = validateGetMusicTracksByEnergy(req.params);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { energyCategory } = validationResult.data!;

    const tracks = await musicService.getMusicTracksByEnergy(
      energyCategory as MusicEnergyLevel
    );

    return ResponseHelper.success(
      res,
      `Music tracks for ${energyCategory} energy retrieved successfully`,
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
    // Validate route parameters
    const validationResult = validateGetMusicTrackById(req.params);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { trackId } = validationResult.data!;

    const track = await musicService.getMusicTrackWithUrls(trackId);

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
    // Validate route parameters
    const validationResult = validateStreamMusicPreview(req.params);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { trackId } = validationResult.data!;

    const track = await musicService.getMusicTrackById(trackId);

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
    // Validate route parameters
    const validationResult = validateDeleteMusicTrack(req.params);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { trackId } = validationResult.data!;

    const success = await musicService.deleteMusicTrack(trackId);

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
 */
export async function getMusicTracksStats(req: Request, res: Response) {
  try {
    const stats = await musicService.getMusicTracksCount();

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
export { musicUpload as upload };
