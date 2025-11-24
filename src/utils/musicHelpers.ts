import { MusicEnergyLevel } from "../constants/voiceEnergy";
import { VALID_ENERGY_CATEGORIES } from "../constants/music.constants";

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract S3 key from S3 URL
 */
export function extractS3KeyFromUrl(s3Url: string): string {
  // Remove protocol and domain, keep only the path
  return s3Url.split("/").slice(3).join("/");
}

/**
 * Validate energy category
 */
export function isValidEnergyCategory(
  category: string
): category is MusicEnergyLevel {
  return VALID_ENERGY_CATEGORIES.includes(category as MusicEnergyLevel);
}

