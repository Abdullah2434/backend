import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types";
import { UserVideoSettingsService } from "../services/userVideoSettings.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  getUserVideoSettingsSchema,
  saveUserVideoSettingsSchema,
} from "../validations/userSettings.validations";

// ==================== CONSTANTS ====================
const DEFAULT_AVATAR_TYPE = "video_avatar";

// Required fields for validation
const REQUIRED_FIELDS = [
  "prompt",
  "name",
  "position",
  "companyName",
  "license",
  "tailoredFit",
  "socialHandles",
  "city",
  "preferredTone",
  "callToAction",
  "email",
] as const;

// ==================== SERVICE INSTANCE ====================
const userVideoSettingsService = new UserVideoSettingsService();

// ==================== HELPER FUNCTIONS ====================
/**
 * Parse avatar object (can be string or object)
 */
function parseAvatarObject(fieldName: string, value: any): any {
  if (!value) return null;

  // If it's already an object with avatar_id and avatarType
  if (
    typeof value === "object" &&
    value !== null &&
    value.avatar_id &&
    value.avatarType
  ) {
    return {
      avatar_id: String(value.avatar_id).trim(),
      avatarType: String(value.avatarType).trim(),
    };
  }

  // If it's a string, treat it as just the avatar_id (backward compatibility)
  if (typeof value === "string") {
    return {
      avatar_id: value.trim(),
      avatarType: DEFAULT_AVATAR_TYPE,
    };
  }

  return null;
}

/**
 * Normalize avatar array from various formats
 */
function normalizeAvatarArray(avatar: any): string[] {
  let avatarArray: any = avatar;

  if (typeof avatar === "string") {
    try {
      avatarArray = JSON.parse(avatar);
    } catch (parseError) {
      throw new Error("avatar field must be a valid array or JSON string");
    }
  } else if (Array.isArray(avatar)) {
    avatarArray = avatar;
  } else if (typeof avatar === "object" && avatar !== null) {
    // Handle object with numeric keys (e.g., {'0': 'value1', '1': 'value2'})
    avatarArray = Object.values(avatar);
  } else {
    throw new Error(
      "avatar field must be an array, object with numeric keys, or JSON string"
    );
  }

  // Ensure all avatar IDs in array are strings and filter empty ones
  const normalized = avatarArray
    .map((id: any) => String(id).trim())
    .filter((id: string) => id.length > 0);

  if (normalized.length === 0) {
    throw new Error("avatar array must contain at least one valid avatar ID");
  }

  return normalized;
}

/**
 * Format user video settings response
 */
function formatUserVideoSettingsResponse(userSettings: any) {
  return {
    prompt: userSettings.prompt,
    avatar: userSettings.avatar,
    titleAvatar: userSettings.titleAvatar,
    conclusionAvatar: userSettings.conclusionAvatar,
    bodyAvatar: userSettings.bodyAvatar || undefined,
    name: userSettings.name,
    position: userSettings.position,
    companyName: userSettings.companyName,
    license: userSettings.license,
    tailoredFit: userSettings.tailoredFit,
    socialHandles: userSettings.socialHandles,
    city: userSettings.city,
    preferredTone: userSettings.preferredTone,
    callToAction: userSettings.callToAction,
    gender: userSettings.gender,
    language: userSettings.language,
    email: userSettings.email,
    selectedVoiceId: userSettings.selectedVoiceId,
    selectedMusicTrackId: userSettings.selectedMusicTrackId,
    preset: userSettings.preset,
    selectedVoicePreset: userSettings.selectedVoicePreset,
    selectedMusicPreset: userSettings.selectedMusicPreset,
    updatedAt: userSettings.updatedAt,
  };
}

/**
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Get user video settings
 * GET /api/user-settings/video?email=user@example.com
 */
export async function getUserVideoSettings(req: Request, res: Response) {
  try {
    // Validate query parameters
    const validationResult = getUserVideoSettingsSchema.safeParse({
      email: req.query.email,
    });

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { email } = validationResult.data;

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
    const validationResult = saveUserVideoSettingsSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
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
    } = validationResult.data;

    // Normalize avatar array
    let normalizedAvatarArray: string[];
    try {
      normalizedAvatarArray = normalizeAvatarArray(avatar);
    } catch (error: any) {
      return ResponseHelper.badRequest(res, error.message);
    }

    // Parse avatar objects
    const parsedTitleAvatar = parseAvatarObject("titleAvatar", titleAvatar);
    const parsedConclusionAvatar = parseAvatarObject(
      "conclusionAvatar",
      conclusionAvatar
    );
    const parsedBodyAvatar = bodyAvatar
      ? parseAvatarObject("bodyAvatar", bodyAvatar)
      : undefined;

    if (!parsedTitleAvatar) {
      return ResponseHelper.badRequest(
        res,
        "titleAvatar is required and must be an object with avatar_id and avatarType, or a string"
      );
    }

    if (!parsedConclusionAvatar) {
      return ResponseHelper.badRequest(
        res,
        "conclusionAvatar is required and must be an object with avatar_id and avatarType, or a string"
      );
    }

    // Save or update user video settings
    const savedSettings = await userVideoSettingsService.saveUserVideoSettings({
      prompt,
      avatar: normalizedAvatarArray,
      titleAvatar: parsedTitleAvatar,
      conclusionAvatar: parsedConclusionAvatar,
      bodyAvatar: parsedBodyAvatar,
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
