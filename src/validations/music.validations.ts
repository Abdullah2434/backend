import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Upload music track validation schema
 */
export const uploadMusicTrackSchema = z.object({
  name: z.string().min(1, "Name is required"),
  energyCategory: z.enum(["high", "mid", "low"], {
    errorMap: () => ({
      message: "energyCategory must be 'high', 'mid', or 'low'",
    }),
  }),
  duration: z
    .string()
    .min(1, "Duration is required")
    .refine(
      (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
      "Duration must be a positive number"
    ),
  artist: z.string().optional(),
  source: z.string().optional(),
  license: z.string().optional(),
  genre: z.string().optional(),
});

/**
 * Get music tracks by energy category query parameter schema
 */
export const getAllMusicTracksQuerySchema = z.object({
  energyCategory: z
    .enum(["high", "mid", "low"], {
      errorMap: () => ({
        message: "Invalid energy category. Must be 'high', 'mid', or 'low'",
      }),
    })
    .optional(),
});

/**
 * Get music tracks by energy category route parameter schema
 */
export const getMusicTracksByEnergySchema = z.object({
  energyCategory: z.enum(["high", "mid", "low"], {
    errorMap: () => ({
      message: "Invalid energy category. Must be 'high', 'mid', or 'low'",
    }),
  }),
});

/**
 * Get music track by ID route parameter schema
 */
export const getMusicTrackByIdSchema = z.object({
  trackId: z.string().min(1, "trackId is required"),
});

/**
 * Stream music preview route parameter schema
 */
export const streamMusicPreviewSchema = z.object({
  trackId: z.string().min(1, "trackId is required"),
});

/**
 * Delete music track route parameter schema
 */
export const deleteMusicTrackSchema = z.object({
  trackId: z.string().min(1, "trackId is required"),
});

// ==================== TYPE INFERENCES ====================

export type UploadMusicTrackData = z.infer<typeof uploadMusicTrackSchema>;
export type GetAllMusicTracksQueryData = z.infer<
  typeof getAllMusicTracksQuerySchema
>;
export type GetMusicTracksByEnergyData = z.infer<
  typeof getMusicTracksByEnergySchema
>;
export type GetMusicTrackByIdData = z.infer<typeof getMusicTrackByIdSchema>;
export type StreamMusicPreviewData = z.infer<typeof streamMusicPreviewSchema>;
export type DeleteMusicTrackData = z.infer<typeof deleteMusicTrackSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface UploadMusicTrackValidationResult {
  success: boolean;
  data?: UploadMusicTrackData;
  errors?: ValidationError[];
}

export interface GetAllMusicTracksQueryValidationResult {
  success: boolean;
  data?: GetAllMusicTracksQueryData;
  errors?: ValidationError[];
}

export interface GetMusicTracksByEnergyValidationResult {
  success: boolean;
  data?: GetMusicTracksByEnergyData;
  errors?: ValidationError[];
}

export interface GetMusicTrackByIdValidationResult {
  success: boolean;
  data?: GetMusicTrackByIdData;
  errors?: ValidationError[];
}

export interface StreamMusicPreviewValidationResult {
  success: boolean;
  data?: StreamMusicPreviewData;
  errors?: ValidationError[];
}

export interface DeleteMusicTrackValidationResult {
  success: boolean;
  data?: DeleteMusicTrackData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate upload music track request data
 */
export function validateUploadMusicTrack(
  data: unknown
): UploadMusicTrackValidationResult {
  const validationResult = uploadMusicTrackSchema.safeParse(data);

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
 * Validate get all music tracks query parameters
 */
export function validateGetAllMusicTracksQuery(
  data: unknown
): GetAllMusicTracksQueryValidationResult {
  const validationResult = getAllMusicTracksQuerySchema.safeParse(data);

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
 * Validate get music tracks by energy route parameter
 */
export function validateGetMusicTracksByEnergy(
  data: unknown
): GetMusicTracksByEnergyValidationResult {
  const validationResult = getMusicTracksByEnergySchema.safeParse(data);

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
 * Validate get music track by ID route parameter
 */
export function validateGetMusicTrackById(
  data: unknown
): GetMusicTrackByIdValidationResult {
  const validationResult = getMusicTrackByIdSchema.safeParse(data);

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
 * Validate stream music preview route parameter
 */
export function validateStreamMusicPreview(
  data: unknown
): StreamMusicPreviewValidationResult {
  const validationResult = streamMusicPreviewSchema.safeParse(data);

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
 * Validate delete music track route parameter
 */
export function validateDeleteMusicTrack(
  data: unknown
): DeleteMusicTrackValidationResult {
  const validationResult = deleteMusicTrackSchema.safeParse(data);

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

