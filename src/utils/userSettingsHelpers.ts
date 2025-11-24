import { DEFAULT_AVATAR_TYPE } from "../constants/userSettings.constants";

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse avatar object (can be string or object)
 */
export function parseAvatarObject(fieldName: string, value: any): any {
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
export function normalizeAvatarArray(avatar: any): string[] {
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
export function formatUserVideoSettingsResponse(userSettings: any) {
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
export function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

/**
 * Parse and validate avatar objects from validated data
 */
export function parseAvatarObjects(data: {
  titleAvatar: any;
  conclusionAvatar: any;
  bodyAvatar?: any;
}): {
  titleAvatar: any;
  conclusionAvatar: any;
  bodyAvatar?: any;
} {
  const parsedTitleAvatar = parseAvatarObject("titleAvatar", data.titleAvatar);
  const parsedConclusionAvatar = parseAvatarObject(
    "conclusionAvatar",
    data.conclusionAvatar
  );
  const parsedBodyAvatar = data.bodyAvatar
    ? parseAvatarObject("bodyAvatar", data.bodyAvatar)
    : undefined;

  if (!parsedTitleAvatar) {
    throw new Error(
      "titleAvatar is required and must be an object with avatar_id and avatarType, or a string"
    );
  }

  if (!parsedConclusionAvatar) {
    throw new Error(
      "conclusionAvatar is required and must be an object with avatar_id and avatarType, or a string"
    );
  }

  return {
    titleAvatar: parsedTitleAvatar,
    conclusionAvatar: parsedConclusionAvatar,
    bodyAvatar: parsedBodyAvatar,
  };
}

