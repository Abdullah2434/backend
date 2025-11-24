import { Request, Response } from "express";
import { UserVideoSettingsService } from "../services/userVideoSettings.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateGetUserVideoSettings,
  validateSaveUserVideoSettings,
} from "../validations/userSettings.validations";
import {
  normalizeAvatarArray,
  formatUserVideoSettingsResponse,
  getErrorStatus,
  parseAvatarObjects,
} from "../utils/userSettingsHelpers";

// ==================== SERVICE INSTANCE ====================
const userVideoSettingsService = new UserVideoSettingsService();

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Get user video settings
 * GET /api/user-settings/video?email=user@example.com
 */
export async function getUserVideoSettings(req: Request, res: Response) {
  try {
    // Validate query parameters
    const validationResult = validateGetUserVideoSettings(req.query);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { email } = validationResult.data!;

    const userSettings = await userVideoSettingsService.getUserVideoSettings(
      email
    );

    if (!userSettings) {
      return ResponseHelper.notFound(
        res,
        "No video settings found for this user"
      );
    }

    return ResponseHelper.success(
      res,
      "User video settings retrieved successfully",
      formatUserVideoSettingsResponse(userSettings)
    );
  } catch (error: any) {
    console.error("Error in getUserVideoSettings:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get user video settings",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Save user video settings
 * POST /api/user-settings/video
 */
export async function saveUserVideoSettings(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = validateSaveUserVideoSettings(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const {
      prompt,
      avatar,
      titleAvatar,
      conclusionAvatar,
      bodyAvatar,
      name,
      position,
      companyName,
      license,
      tailoredFit,
      socialHandles,
      city,
      preferredTone,
      callToAction,
      gender,
      language,
      email,
      selectedVoiceId,
      selectedMusicTrackId,
      preset,
      selectedVoicePreset,
      selectedMusicPreset,
    } = validationResult.data!;

    // Normalize avatar array
    let normalizedAvatarArray: string[];
    try {
      normalizedAvatarArray = normalizeAvatarArray(avatar);
    } catch (error: any) {
      return ResponseHelper.badRequest(res, error.message);
    }

    // Parse avatar objects
    let parsedAvatars;
    try {
      parsedAvatars = parseAvatarObjects({
        titleAvatar,
        conclusionAvatar,
        bodyAvatar,
      });
    } catch (error: any) {
      return ResponseHelper.badRequest(res, error.message);
    }

    // Save or update user video settings
    const savedSettings = await userVideoSettingsService.saveUserVideoSettings({
      prompt,
      avatar: normalizedAvatarArray,
      titleAvatar: parsedAvatars.titleAvatar,
      conclusionAvatar: parsedAvatars.conclusionAvatar,
      bodyAvatar: parsedAvatars.bodyAvatar,
      name,
      position,
      companyName,
      license,
      tailoredFit,
      socialHandles,
      city,
      preferredTone,
      callToAction,
      gender,
      language,
      email,
      selectedVoiceId,
      selectedMusicTrackId,
      preset,
      selectedVoicePreset,
      selectedMusicPreset,
    });

    return ResponseHelper.success(
      res,
      "User video settings saved successfully",
      formatUserVideoSettingsResponse(savedSettings)
    );
  } catch (error: any) {
    console.error("Error in saveUserVideoSettings:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to save user video settings",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
