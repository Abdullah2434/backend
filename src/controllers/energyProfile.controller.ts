import { Request, Response } from "express";
import { UserVideoSettingsService } from "../services/userVideoSettings.service";
import {
  VoiceEnergyLevel,
  MusicEnergyLevel,
  ENERGY_PROFILE_DESCRIPTIONS,
} from "../constants/voiceEnergy";

const userVideoSettingsService = new UserVideoSettingsService();

/**
 * Set energy profile preset (updates both voice and music energy)
 */
export async function setPresetProfile(req: Request, res: Response) {
  try {
    const { energyLevel } = req.body;
    const email = req.user?.email;

    if (!email) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!energyLevel || !["high", "mid", "low"].includes(energyLevel)) {
      return res.status(400).json({
        success: false,
        message: "Invalid energy level. Must be 'high', 'mid', or 'low'",
      });
    }

    const settings = await userVideoSettingsService.setEnergyProfile(
      email,
      energyLevel as VoiceEnergyLevel
    );

    return res.json({
      success: true,
      message: `Energy profile set to ${energyLevel}`,
      data: {
        voiceEnergy: settings.voiceEnergy,
        musicEnergy: settings.musicEnergy,
        customVoiceMusic: settings.customVoiceMusic,
        selectedMusicTrackId: settings.selectedMusicTrackId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to set energy profile",
    });
  }
}

/**
 * Set custom voice and music settings independently
 */
export async function setCustomVoiceMusic(req: Request, res: Response) {
  try {
    const { voiceEnergy, musicEnergy, selectedMusicTrackId } = req.body;
    const email = req.user?.email;

    if (!email) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (
      !voiceEnergy ||
      !musicEnergy ||
      !["high", "mid", "low"].includes(voiceEnergy) ||
      !["high", "mid", "low"].includes(musicEnergy)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid energy levels. Both voiceEnergy and musicEnergy must be 'high', 'mid', or 'low'",
      });
    }

    const settings = await userVideoSettingsService.setCustomVoiceMusic(
      email,
      voiceEnergy as VoiceEnergyLevel,
      musicEnergy as MusicEnergyLevel,
      selectedMusicTrackId
    );

    return res.json({
      success: true,
      message: "Custom voice and music settings updated",
      data: {
        voiceEnergy: settings.voiceEnergy,
        musicEnergy: settings.musicEnergy,
        customVoiceMusic: settings.customVoiceMusic,
        selectedMusicTrackId: settings.selectedMusicTrackId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to set custom voice and music settings",
    });
  }
}

/**
 * Get user's current energy profile settings
 */
export async function getCurrentProfile(req: Request, res: Response) {
  try {
    const email = req.user?.email;

    if (!email) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const profile = await userVideoSettingsService.getEnergyProfile(email);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "User video settings not found",
      });
    }

    return res.json({
      success: true,
      message: "Energy profile retrieved successfully",
      data: profile,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get energy profile",
    });
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

    return res.json({
      success: true,
      message: "Preset configurations retrieved successfully",
      data: presets,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get preset configurations",
    });
  }
}
