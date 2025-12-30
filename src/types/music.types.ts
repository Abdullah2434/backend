// ==================== MUSIC TYPES ====================

import { MusicEnergyLevel } from "../constants/voiceEnergy";
import { IMusicTrack } from "../models/MusicTrack";

/**
 * Music track metadata
 */
export interface MusicTrackMetadata {
  artist?: string;
  source?: string;
  license?: string;
  genre?: string;
}

/**
 * Music track creation data
 */
export interface CreateMusicTrackData {
  name: string;
  energyCategory: MusicEnergyLevel;
  duration: number;
  fullTrackBuffer: Buffer;
  filename: string;
  contentType: string;
  userId?: string;
  metadata?: MusicTrackMetadata;
}

/**
 * Music track with URLs response
 */
export interface MusicTrackWithUrls extends IMusicTrack {
  fullTrackUrl?: string;
  previewUrl?: string;
}

/**
 * Music tracks statistics
 */
export interface MusicTracksStats {
  total: number;
  byEnergy: {
    high: number;
    mid: number;
    low: number;
    custom: number;
  };
}

/**
 * S3 configuration for music service
 */
export interface S3Config {
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

