import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types";
import { UserVideoSettingsService } from "../services/userVideoSettings.service";
import {
  VoiceEnergyLevel,
  MusicEnergyLevel,
  ENERGY_PROFILE_DESCRIPTIONS,
} from "../constants/voiceEnergy";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateSetPresetProfile,
  validateSetCustomVoiceMusic,
} from "../validations/energyProfile.validations";
import {
  getUserEmail,
  formatEnergyProfileResponse,
} from "../utils/energyProfileHelpers";

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
    const email = getUserEmail(req);

    if (!email) {
      return ResponseHelper.unauthorized(res, "User not authenticated");
    }

    // Validate request body
    const validationResult = validateSetPresetProfile(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { energyLevel } = validationResult.data!;

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
    const email = getUserEmail(req);

    if (!email) {
      return ResponseHelper.unauthorized(res, "User not authenticated");
    }

    // Validate request body
    const validationResult = validateSetCustomVoiceMusic(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { voiceEnergy, musicEnergy, selectedMusicTrackId } =
      validationResult.data!;

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
    const email = getUserEmail(req);

    if (!email) {
      return ResponseHelper.unauthorized(res, "User not authenticated");
    }

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
    const presets = Object.entries(ENERGY_PROFILE_DESCRIPTIONS).map(
      ([key, value]) => ({
        energyLevel: key,
        ...value,
      })
    );

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
