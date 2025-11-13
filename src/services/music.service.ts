import MusicTrack, { IMusicTrack } from "../models/MusicTrack";
import { S3Service } from "./s3";
import { MusicPreviewService } from "./musicPreview.service";
import crypto from "crypto";

export interface CreateMusicTrackData {
  name: string;
  energyCategory: "high" | "mid" | "low";
  duration: number;
  fullTrackBuffer: Buffer;
  filename: string;
  contentType: string;
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
   */
  async getMusicTracksByEnergy(
    energyCategory: "high" | "mid" | "low"
  ): Promise<IMusicTrack[]> {
    const tracks = await MusicTrack.find({ energyCategory }).sort({ createdAt: -1 });
    // Generate clean URLs for all tracks
    return Promise.all(tracks.map(track => this.generateCleanUrlsForTrack(track)));
  }

  /**
   * Get all music tracks (with optional energy filter) with clean MP3 URLs
   */
  async getAllMusicTracks(
    energyCategory?: "high" | "mid" | "low"
  ): Promise<IMusicTrack[]> {
    const filter = energyCategory ? { energyCategory } : {};
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
    energyCategory: "high" | "mid" | "low"
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
   */
  async getMusicTracksCount(): Promise<{
    high: number;
    mid: number;
    low: number;
    total: number;
  }> {
    const [high, mid, low, total] = await Promise.all([
      MusicTrack.countDocuments({ energyCategory: "high" }),
      MusicTrack.countDocuments({ energyCategory: "mid" }),
      MusicTrack.countDocuments({ energyCategory: "low" }),
      MusicTrack.countDocuments(),
    ]);

    return { high, mid, low, total };
  }
}

export default MusicService;
