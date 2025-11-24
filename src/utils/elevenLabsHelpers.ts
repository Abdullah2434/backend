import mongoose from "mongoose";
import { Request } from "express";
import { AuthenticatedRequest } from "../types";
import AuthService from "../modules/auth/services/auth.service";
import UserVideoSettings from "../models/UserVideoSettings";

// ==================== VOICE PRESETS ====================
// Voice preset configurations - optimized for natural speech
// Lower stability = more emotional range and natural variation
// Higher similarity_boost = closer to original voice
// Style controls exaggeration (0 = natural, higher = more dramatic)
// Speed: 0.9-1.1 range for natural pacing
export const VOICE_PRESETS = {
  low: {
    stability: 0.75, // Lower for more natural variation
    similarity_boost: 0.8, // Higher for better voice match
    style: 0.0, // Lower for more natural delivery
    use_speaker_boost: true,
    speed: 0.85, // Slightly faster but still natural
  },
  medium: {
    stability: 0.5, // Balanced for natural speech
    similarity_boost: 0.75, // Higher for better voice match
    style: 0.2, // Lower for natural delivery
    use_speaker_boost: true,
    speed: 1.0, // Natural pace
  },
  mid: {
    stability: 0.5, // Balanced for natural speech
    similarity_boost: 0.75, // Higher for better voice match
    style: 0.2, // Lower for natural delivery
    use_speaker_boost: true,
    speed: 1.0, // Natural pace
  },
  high: {
    stability: 0.25, // Slightly higher but still allows variation
    similarity_boost: 0.7, // Higher for better voice match
    style: 0.5, // Very low for most natural delivery
    use_speaker_boost: true,
    speed: 1.15, // Slightly slower for emphasis
  },
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get voice settings based on preset (case insensitive)
 */
export function getVoiceSettingsByPreset(preset: string): {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
} | null {
  const presetLower = preset?.toLowerCase().trim();
  const presetKey = presetLower as keyof typeof VOICE_PRESETS;
  return VOICE_PRESETS[presetKey] || null;
}

/**
 * Extract access token from request headers
 */
export function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.replace("Bearer ", "") || null;
}

/**
 * Get user ID from authenticated request
 */
export function getUserIdFromRequest(
  req: AuthenticatedRequest | Request
): string | undefined {
  if ("user" in req && req.user?._id) {
    return req.user._id.toString();
  }
  return (
    (req as any).user?._id || (req as any).user?.userId || (req as any).user?.id
  );
}

/**
 * Build voice filter for database query
 */
export function buildVoiceFilter(userId?: string): mongoose.FilterQuery<any> {
  const baseFilter = {
    $or: [{ userId: { $exists: false } }, { userId: null }],
  };

  if (userId) {
    return {
      $or: [...baseFilter.$or, { userId: new mongoose.Types.ObjectId(userId) }],
    };
  }

  return baseFilter;
}

/**
 * Validate and get user for cloned voice access
 */
export async function validateClonedVoiceAccess(
  accessToken: string,
  authService: AuthService
): Promise<{ user: any; voiceSettings: any } | null> {
  try {
    const user = await authService.getCurrentUser(accessToken);
    if (!user) {
      return null;
    }

    const userVideoSettings = await UserVideoSettings.findOne({
      userId: user._id,
    });

    let voiceSettings = null;
    if (userVideoSettings?.preset) {
      voiceSettings = getVoiceSettingsByPreset(userVideoSettings.preset);
    }

    return { user, voiceSettings };
  } catch (error) {
    return null;
  }
}

/**
 * Extract files from multer request
 */
export function extractFilesFromRequest(
  req: AuthenticatedRequest & {
    files?:
      | Express.Multer.File[]
      | { [fieldname: string]: Express.Multer.File[] };
  }
): Express.Multer.File[] | undefined {
  if (!req.files) {
    return undefined;
  }

  if (Array.isArray(req.files)) {
    return req.files;
  }

  // Fallback: if it's an object with fieldname keys, extract the array
  const fileArray = Object.values(req.files).flat();
  return fileArray.length > 0 ? fileArray : undefined;
}

