import MusicTrack, { IMusicTrack } from "../../models/MusicTrack";
import { S3Service } from "../s3.service";
import { MusicPreviewService } from "./musicPreview.service";
import crypto from "crypto";

export interface CreateMusicTrackData {
  name: string;
  energyCategory: "high" | "mid" | "low" | "custom";
  duration: number;
  fullTrackBuffer: Buffer;
  filename: string;
  contentType: string;
  userId?: string;
  metadata?: {
    artist?: string;
    source?: string;
    license?: string;
    genre?: string;
  };
}

export class MusicService {
  private s3Service: S3Service;
  private previewService: MusicPreviewService;

  constructor(s3Service: S3Service) {
    this.s3Service = s3Service;
    this.previewService = new MusicPreviewService(s3Service);
  }

  /**
   * Create a new music track with preview generation
   */
  async createMusicTrack(data: CreateMusicTrackData): Promise<IMusicTrack> {
    const trackId = `track_${Date.now()}_${crypto
      .randomBytes(8)
      .toString("hex")}`;

    try {
      // Process and upload track with preview
      const uploadResult = await this.previewService.processAndUploadMusicTrack(
        trackId,
        data.energyCategory,
        data.fullTrackBuffer,
        data.filename,
        data.contentType,
        {
          trackId,
          energyCategory: data.energyCategory,
          ...data.metadata,
        }
      );

      // Create database record
      const musicTrack = new MusicTrack({
        trackId,
        name: data.name,
        energyCategory: data.energyCategory,
        s3FullTrackUrl: uploadResult.fullTrackUrl,
        s3PreviewUrl: uploadResult.previewUrl,
        duration: data.duration,
        userId: data.userId ? (data.userId as any) : undefined,
        metadata: data.metadata || {},
      });

      await musicTrack.save();
      return musicTrack;
    } catch (error: any) {

      throw new Error(`Failed to create music track: ${error.message}`);
    }
  }

  /**
   * Get all music tracks by energy category with clean MP3 URLs
   * For custom tracks, only returns tracks for the specified user
   * For other categories, returns default tracks (no userId)
   */
  async getMusicTracksByEnergy(
    energyCategory: "high" | "mid" | "low" | "custom",
    userId?: string
  ): Promise<IMusicTrack[]> {
    let filter: any = { energyCategory };
    
    if (energyCategory === "custom") {
      // Custom tracks: only return user's own tracks
      if (userId) {
        filter.userId = userId;
      } else {
        // No userId provided, return empty array for custom
        return [];
      }
    } else {
      // Default tracks (high/mid/low): only return tracks without userId
      filter.userId = { $exists: false };
    }
    
    const tracks = await MusicTrack.find(filter).sort({ createdAt: -1 });
    // Generate clean URLs for all tracks
    return Promise.all(tracks.map(track => this.generateCleanUrlsForTrack(track)));
  }

  /**
   * Get all music tracks (with optional energy filter) with clean MP3 URLs
   * When no filter is provided, returns all default tracks (high/mid/low) + user's custom tracks
   * When filter is provided, applies same logic as getMusicTracksByEnergy
   */
  async getAllMusicTracks(
    energyCategory?: "high" | "mid" | "low" | "custom",
    userId?: string
  ): Promise<IMusicTrack[]> {
    let filter: any = {};
    
    if (energyCategory) {
      if (energyCategory === "custom") {
        // Custom tracks: only return user's own tracks
        if (userId) {
          filter = { energyCategory, userId };
        } else {
          // No userId provided, return empty array for custom
          return [];
        }
      } else {
        // Default tracks (high/mid/low): only return tracks without userId
        filter = { energyCategory, userId: { $exists: false } };
      }
    } else {
      // No filter: return default tracks + user's custom tracks
      if (userId) {
        filter = {
          $or: [
            { userId: { $exists: false } }, // Default tracks
            { userId, energyCategory: "custom" } // User's custom tracks
          ]
        };
      } else {
        // No userId: only return default tracks
        filter = { userId: { $exists: false } };
      }
    }
    
    const tracks = await MusicTrack.find(filter).sort({ createdAt: -1 });
    // Generate clean URLs for all tracks
    return Promise.all(tracks.map(track => this.generateCleanUrlsForTrack(track)));
  }

  /**
   * Get music track by ID with clean URLs
   */
  async getMusicTrackById(trackId: string): Promise<IMusicTrack | null> {
    const track = await MusicTrack.findOne({ trackId });
    if (!track) return null;
    return await this.generateCleanUrlsForTrack(track);
  }

  /**
   * Get random music track by energy category with clean URLs
   */
  async getRandomTrackByEnergy(
    energyCategory: "high" | "mid" | "low" | "custom"
  ): Promise<IMusicTrack | null> {
    const tracks = await MusicTrack.find({ energyCategory });
    if (tracks.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * tracks.length);
    const track = tracks[randomIndex];
    return await this.generateCleanUrlsForTrack(track);
  }

  /**
   * Delete music track and S3 files
   */
  async deleteMusicTrack(trackId: string): Promise<boolean> {
    const track = await MusicTrack.findOne({ trackId });
    if (!track) return false;

    try {
      // Extract S3 keys from URLs
      const fullTrackS3Key = this.extractS3KeyFromUrl(track.s3FullTrackUrl);
      const previewS3Key = this.extractS3KeyFromUrl(track.s3PreviewUrl);

      // Delete from S3
      if (fullTrackS3Key) {
        await this.s3Service.deleteMusicTrack(fullTrackS3Key);
      }
      if (previewS3Key) {
        await this.s3Service.deleteMusicTrack(previewS3Key);
      }

      // Delete from database
      await MusicTrack.deleteOne({ trackId });
      return true;
    } catch (error: any) {

      throw new Error(`Failed to delete music track: ${error.message}`);
    }
  }

  /**
   * Generate clean MP3 URLs for a track (without query parameters)
   */
  private async generateCleanUrlsForTrack(track: IMusicTrack): Promise<IMusicTrack> {
    try {
      // Extract S3 keys from stored URLs (which may have query parameters)
      const fullTrackS3Key = this.extractS3KeyFromUrl(track.s3FullTrackUrl);
      const previewS3Key = this.extractS3KeyFromUrl(track.s3PreviewUrl);

      // Generate clean URLs (without query parameters)
      if (fullTrackS3Key) {
        track.s3FullTrackUrl = await this.s3Service.getMusicTrackUrl(
          fullTrackS3Key
        );
      }
      if (previewS3Key) {
        track.s3PreviewUrl = await this.s3Service.getMusicTrackUrl(
          previewS3Key
        );
      }

      return track;
    } catch (error: any) {
  
      // Return track with original URLs if generation fails
      return track;
    }
  }

  /**
   * Get music track with fresh clean URLs (without query parameters)
   */
  async getMusicTrackWithUrls(trackId: string): Promise<IMusicTrack | null> {
    const track = await MusicTrack.findOne({ trackId });
    if (!track) return null;

    return await this.generateCleanUrlsForTrack(track);
  }

  /**
   * Extract S3 key from S3 URL
   */
  private extractS3KeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch (error: any) {

      return null;
    }
  }

  /**
   * Get music tracks count by energy category
   * For custom, counts only user's tracks if userId provided
   */
  async getMusicTracksCount(userId?: string): Promise<{
    high: number;
    mid: number;
    low: number;
    custom: number;
    total: number;
  }> {
    const [high, mid, low, custom, total] = await Promise.all([
      MusicTrack.countDocuments({ energyCategory: "high", userId: { $exists: false } }),
      MusicTrack.countDocuments({ energyCategory: "mid", userId: { $exists: false } }),
      MusicTrack.countDocuments({ energyCategory: "low", userId: { $exists: false } }),
      userId 
        ? MusicTrack.countDocuments({ energyCategory: "custom", userId })
        : MusicTrack.countDocuments({ energyCategory: "custom" }),
      userId
        ? MusicTrack.countDocuments({
            $or: [
              { userId: { $exists: false } },
              { userId, energyCategory: "custom" }
            ]
          })
        : MusicTrack.countDocuments({ userId: { $exists: false } }),
    ]);

    return { high, mid, low, custom, total };
  }
}

export default MusicService;
