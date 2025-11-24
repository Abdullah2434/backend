import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Set preset profile validation schema
 */
export const setPresetProfileSchema = z.object({
  energyLevel: z.enum(["high", "mid", "low"], {
    errorMap: () => ({
      message: "Invalid energy level. Must be 'high', 'mid', or 'low'",
    }),
  }),
});

/**
 * Set custom voice and music validation schema
 */
export const setCustomVoiceMusicSchema = z.object({
  voiceEnergy: z.enum(["high", "mid", "low"], {
    errorMap: () => ({
      message: "voiceEnergy must be 'high', 'mid', or 'low'",
    }),
  }),
  musicEnergy: z.enum(["high", "mid", "low"], {
    errorMap: () => ({
      message: "musicEnergy must be 'high', 'mid', or 'low'",
    }),
  }),
  selectedMusicTrackId: z.string().min(1, "Music track ID cannot be empty").optional(),
});

// ==================== TYPE INFERENCES ====================

export type SetPresetProfileData = z.infer<typeof setPresetProfileSchema>;
export type SetCustomVoiceMusicData = z.infer<typeof setCustomVoiceMusicSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface SetPresetProfileValidationResult {
  success: boolean;
  data?: SetPresetProfileData;
  errors?: ValidationError[];
}

export interface SetCustomVoiceMusicValidationResult {
  success: boolean;
  data?: SetCustomVoiceMusicData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate set preset profile request data
 * @param data - The data to validate
 * @returns Validation result with either validated data or errors
 */
export function validateSetPresetProfile(
  data: unknown
): SetPresetProfileValidationResult {
  const validationResult = setPresetProfileSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate set custom voice and music request data
 * @param data - The data to validate
 * @returns Validation result with either validated data or errors
 */
export function validateSetCustomVoiceMusic(
  data: unknown
): SetCustomVoiceMusicValidationResult {
  const validationResult = setCustomVoiceMusicSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

