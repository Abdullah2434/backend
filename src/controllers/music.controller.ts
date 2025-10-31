import { Request, Response } from "express";
import { MusicService } from "../services/music.service";
import { S3Service } from "../services/s3";
import multer from "multer";
import { MusicEnergyLevel } from "../constants/voiceEnergy";

// Initialize services
const s3Service = new S3Service({
  region: process.env.AWS_REGION || "us-east-1",
  bucketName: process.env.AWS_S3_BUCKET || "",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
});
const musicService = new MusicService(s3Service);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

/**
 * Upload music track (Admin endpoint)
 */
export async function uploadMusicTrack(req: Request, res: Response) {
  try {
    const { name, energyCategory, duration, artist, source, license, genre } =
      req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Audio file is required",
      });
    }

    if (
      !name ||
      !energyCategory ||
      !duration ||
      !["high", "mid", "low"].includes(energyCategory)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, energyCategory (high/mid/low), and duration are required",
      });
    }

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

    return res.json({
      success: true,
      message: "Music track uploaded successfully",
      data: musicTrack,
    });
  } catch (error: any) {
    console.error("Error uploading music track:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload music track",
    });
  }
}

/**
 * Get all music tracks (with optional energy filter)
 */
export async function getAllMusicTracks(req: Request, res: Response) {
  try {
    const { energyCategory } = req.query;

    const tracks = await musicService.getAllMusicTracks(
      energyCategory as MusicEnergyLevel | undefined
    );

    return res.json({
      success: true,
      message: "Music tracks retrieved successfully",
      data: tracks,
    });
  } catch (error: any) {
    console.error("Error getting music tracks:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get music tracks",
    });
  }
}

/**
 * Get music tracks by energy category
 */
export async function getMusicTracksByEnergy(req: Request, res: Response) {
  try {
    const { energyCategory } = req.params;

    if (!["high", "mid", "low"].includes(energyCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid energy category. Must be 'high', 'mid', or 'low'",
      });
    }

    const tracks = await musicService.getMusicTracksByEnergy(
      energyCategory as MusicEnergyLevel
    );

    return res.json({
      success: true,
      message: `Music tracks for ${energyCategory} energy retrieved successfully`,
      data: tracks,
    });
  } catch (error: any) {
    console.error("Error getting music tracks by energy:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get music tracks",
    });
  }
}

/**
 * Get specific music track details
 */
export async function getMusicTrackById(req: Request, res: Response) {
  try {
    const { trackId } = req.params;

    const track = await musicService.getMusicTrackWithUrls(trackId);

    if (!track) {
      return res.status(404).json({
        success: false,
        message: "Music track not found",
      });
    }

    return res.json({
      success: true,
      message: "Music track retrieved successfully",
      data: track,
    });
  } catch (error: any) {
    console.error("Error getting music track:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get music track",
    });
  }
}

/**
 * Stream music track preview
 */
export async function streamMusicPreview(req: Request, res: Response) {
  try {
    const { trackId } = req.params;

    const track = await musicService.getMusicTrackById(trackId);

    if (!track) {
      return res.status(404).json({
        success: false,
        message: "Music track not found",
      });
    }

    // Generate fresh signed URL for preview
    const previewUrl = await s3Service.getMusicTrackUrl(
      track.s3PreviewUrl.split("/").slice(3).join("/"), // Extract S3 key from URL
      3600 // 1 hour expiration
    );

    // Redirect to S3 URL for streaming
    return res.redirect(previewUrl);
  } catch (error: any) {
    console.error("Error streaming music preview:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to stream music preview",
    });
  }
}

/**
 * Delete music track (Admin endpoint)
 */
export async function deleteMusicTrack(req: Request, res: Response) {
  try {
    const { trackId } = req.params;

    const success = await musicService.deleteMusicTrack(trackId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Music track not found",
      });
    }

    return res.json({
      success: true,
      message: "Music track deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting music track:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete music track",
    });
  }
}

/**
 * Get music tracks statistics
 */
export async function getMusicTracksStats(req: Request, res: Response) {
  try {
    const stats = await musicService.getMusicTracksCount();

    return res.json({
      success: true,
      message: "Music tracks statistics retrieved successfully",
      data: stats,
    });
  } catch (error: any) {
    console.error("Error getting music tracks stats:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get music tracks statistics",
    });
  }
}

// Export multer middleware for use in routes
export { upload };
