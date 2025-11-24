import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Upload media validation schema
 */
export const uploadMediaSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mime_type: z.string().min(1, "Mime type is required"),
  videoUrl: z.string().url("Video URL must be a valid URL").optional(),
});

/**
 * Media ID route parameter validation schema
 */
export const mediaIdParamSchema = z.object({
  mediaId: z.string().min(1, "Media ID is required"),
});

/**
 * Update media status validation schema
 */
export const updateMediaStatusSchema = z.object({
  status: z.enum(["uploaded", "failed"], {
    errorMap: () => ({
      message: 'Status must be either "uploaded" or "failed"',
    }),
  }),
  errorMessage: z.string().optional(),
});

/**
 * Create social post validation schema
 */
export const createSocialPostSchema = z.object({
  accountIds: z.union([
    z.array(z.number()),
    z.string(),
    z.number(),
    z.record(z.number()),
  ]),
  name: z.string().min(1, "Name is required"),
  userId: z.string().optional(), // Optional since we get it from auth
  videoUrl: z
    .string()
    .url("Video URL must be a valid URL")
    .min(1, "Video URL is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  caption: z.string().min(1, "Caption is required"),
  selectedAccounts: z.union([z.array(z.any()), z.record(z.any())]).optional(),
  instagram_caption: z.string().optional(),
  facebook_caption: z.string().optional(),
  linkedin_caption: z.string().optional(),
  twitter_caption: z.string().optional(),
  tiktok_caption: z.string().optional(),
  youtube_caption: z.string().optional(),
})
  .refine(
    (data) => {
      // Normalize accountIds
      let normalizedAccountIds: any = data.accountIds;
      if (typeof normalizedAccountIds === "string") {
        try {
          normalizedAccountIds = JSON.parse(normalizedAccountIds);
        } catch (e) {
          normalizedAccountIds = [parseInt(normalizedAccountIds, 10)];
        }
      } else if (typeof normalizedAccountIds === "number") {
        normalizedAccountIds = [normalizedAccountIds];
      } else if (
        typeof normalizedAccountIds === "object" &&
        normalizedAccountIds !== null &&
        !Array.isArray(normalizedAccountIds)
      ) {
        normalizedAccountIds = Object.values(normalizedAccountIds).filter(
          (val) => typeof val === "number"
        );
      }
      return (
        Array.isArray(normalizedAccountIds) && normalizedAccountIds.length > 0
      );
    },
    {
      message:
        "Account IDs array is required and must contain at least one account",
    }
  )
  .refine(
    (data) => {
      // Normalize selectedAccounts
      let normalizedSelectedAccounts = data.selectedAccounts;
      if (
        normalizedSelectedAccounts &&
        typeof normalizedSelectedAccounts === "object" &&
        !Array.isArray(normalizedSelectedAccounts)
      ) {
        normalizedSelectedAccounts = Object.values(normalizedSelectedAccounts);
      }
      return (
        !normalizedSelectedAccounts ||
        (Array.isArray(normalizedSelectedAccounts) &&
          normalizedSelectedAccounts.length > 0)
      );
    },
    {
      message: "Selected accounts must be an array with at least one account",
    }
  );

// ==================== TYPE INFERENCES ====================

export type UploadMediaData = z.infer<typeof uploadMediaSchema>;
export type MediaIdParamData = z.infer<typeof mediaIdParamSchema>;
export type UpdateMediaStatusData = z.infer<typeof updateMediaStatusSchema>;
export type CreateSocialPostData = z.infer<typeof createSocialPostSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface UploadMediaValidationResult {
  success: boolean;
  data?: UploadMediaData;
  errors?: ValidationError[];
}

export interface MediaIdParamValidationResult {
  success: boolean;
  data?: MediaIdParamData;
  errors?: ValidationError[];
}

export interface UpdateMediaStatusValidationResult {
  success: boolean;
  data?: UpdateMediaStatusData;
  errors?: ValidationError[];
}

export interface CreateSocialPostValidationResult {
  success: boolean;
  data?: CreateSocialPostData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate upload media request data
 */
export function validateUploadMedia(
  data: unknown
): UploadMediaValidationResult {
  const validationResult = uploadMediaSchema.safeParse(data);

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
 * Validate media ID route parameter
 */
export function validateMediaIdParam(
  data: unknown
): MediaIdParamValidationResult {
  const validationResult = mediaIdParamSchema.safeParse(data);

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
 * Validate update media status request data
 */
export function validateUpdateMediaStatus(
  data: unknown
): UpdateMediaStatusValidationResult {
  const validationResult = updateMediaStatusSchema.safeParse(data);

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
 * Validate create social post request data
 */
export function validateCreateSocialPost(
  data: unknown
): CreateSocialPostValidationResult {
  const validationResult = createSocialPostSchema.safeParse(data);

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

