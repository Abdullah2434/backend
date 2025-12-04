import { z } from "zod";

// ==================== USER AVATAR VIDEOS VALIDATIONS ====================

export const uploadAvatarVideosSchema = z.object({
  isAvatarCreated: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === "string") {
        return val === "true" || val === "1";
      }
      return val;
    })
    .optional()
    .default(false),
});

export type UploadAvatarVideosInput = z.infer<typeof uploadAvatarVideosSchema>;

