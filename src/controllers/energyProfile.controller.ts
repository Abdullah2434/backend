import { Request, Response } from "express";
import { AuthenticatedRequest, ValidationError } from "../types";
import { UserVideoSettingsService } from "../services/user";
import {
  VoiceEnergyLevel,
  MusicEnergyLevel,
  ENERGY_PROFILE_DESCRIPTIONS,
} from "../constants/voiceEnergy";
import { ResponseHelper } from "../utils/responseHelper";
import {
  setPresetProfileSchema,
  setCustomVoiceMusicSchema,
} from "../validations/energyProfile.validations";
import { ZodError } from "zod";
import {
  EnergyProfileResponse,
  PresetConfiguration,
} from "../types/energyProfile.types";

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
 * Get user email from authenticated request
 */
function getUserEmail(req: AuthenticatedRequest | Request): string | null {
  return (req as AuthenticatedRequest).user?.email || null;
}

/**
 * Validate user authentication
 */
function requireUserEmail(req: AuthenticatedRequest | Request): string {
  const email = getUserEmail(req);
  if (!email) {
    throw new Error("User not authenticated");
  }
  return email;
}

/**
 * Format energy profile response data
 */
function formatEnergyProfileResponse(settings: any): EnergyProfileResponse {
  return {
    voiceEnergy: settings.voiceEnergy,
    musicEnergy: settings.musicEnergy,
    customVoiceMusic: settings.customVoiceMusic,
    selectedMusicTrackId: settings.selectedMusicTrackId,
  };
}

/**
 * Transform preset descriptions to configuration format
 */
function transformPresetConfigurations(): PresetConfiguration[] {
  return Object.entries(ENERGY_PROFILE_DESCRIPTIONS).map(([key, value]) => ({
    energyLevel: key,
    ...value,
  }));
}

// ==================== SERVICE INSTANCE ====================
const userVideoSettingsService = new UserVideoSettingsService();

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Set energy profile preset (updates both voice and music energy)
 */
export async function setPresetProfile(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const email = requireUserEmail(req);

    // Validate request body
    const validationResult = setPresetProfileSchema.safeParse(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const { energyLevel } = validationResult.data;

    // Set energy profile
    const settings = await userVideoSettingsService.setEnergyProfile(
      email,
      energyLevel as VoiceEnergyLevel
    );

    return ResponseHelper.success(
      res,
      `Energy profile set to ${energyLevel}`,
      formatEnergyProfileResponse(settings)
    );
  } catch (error: any) {
    console.error("Error in setPresetProfile:", error);

    if (error.message === "User not authenticated") {
      return ResponseHelper.unauthorized(res, error.message);
    }

    return ResponseHelper.serverError(
      res,
      error.message || "Failed to set energy profile",
      process.env.NODE_ENV === "development" ? error.stack : undefined
    );
  }
}

/**
 * Set custom voice and music settings independently
 */
export async function setCustomVoiceMusic(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const email = requireUserEmail(req);

    // Validate request body
    const validationResult = setCustomVoiceMusicSchema.safeParse(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const { voiceEnergy, musicEnergy, selectedMusicTrackId } =
      validationResult.data;

    // Set custom voice and music settings
    const settings = await userVideoSettingsService.setCustomVoiceMusic(
      email,
      voiceEnergy as VoiceEnergyLevel,
      musicEnergy as MusicEnergyLevel,
      selectedMusicTrackId
    );

    return ResponseHelper.success(
      res,
      "Custom voice and music settings updated",
      formatEnergyProfileResponse(settings)
    );
  } catch (error: any) {
    console.error("Error in setCustomVoiceMusic:", error);

    if (error.message === "User not authenticated") {
      return ResponseHelper.unauthorized(res, error.message);
    }

    return ResponseHelper.serverError(
      res,
      error.message || "Failed to set custom voice and music settings",
      process.env.NODE_ENV === "development" ? error.stack : undefined
    );
  }
}

/**
 * Get user's current energy profile settings
 */
export async function getCurrentProfile(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const email = requireUserEmail(req);

    // Get energy profile
    const profile = await userVideoSettingsService.getEnergyProfile(email);
    if (!profile) {
      return ResponseHelper.notFound(res, "User video settings not found");
    }

    return ResponseHelper.success(
      res,
      "Energy profile retrieved successfully",
      profile
    );
  } catch (error: any) {
    console.error("Error in getCurrentProfile:", error);

    if (error.message === "User not authenticated") {
      return ResponseHelper.unauthorized(res, error.message);
    }

    return ResponseHelper.serverError(
      res,
      error.message || "Failed to get energy profile"
    );
  }
}

/**
 * Get all preset configurations with descriptions
 */
export async function getPresetConfigurations(req: Request, res: Response) {
  try {
    const presets = transformPresetConfigurations();

    return ResponseHelper.success(
      res,
      "Preset configurations retrieved successfully",
      presets
    );
  } catch (error: any) {
    console.error("Error in getPresetConfigurations:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to get preset configurations"
    );
  }
}
