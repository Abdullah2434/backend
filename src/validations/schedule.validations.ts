import { z } from "zod";

// ==================== SCHEDULE VALIDATIONS ====================

export const editSchedulePostSchema = z.object({
  description: z.string().optional(),
  keypoints: z.string().optional(),
  scheduledFor: z.union([z.string(), z.date()]).optional(),
  captions: z
    .object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      linkedin: z.string().optional(),
      twitter: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional(),
    })
    .optional(),
}).refine(
  (data) => {
    // At least one field must be provided
    return (
      data.description !== undefined ||
      data.keypoints !== undefined ||
      data.scheduledFor !== undefined ||
      data.captions !== undefined
    );
  },
  {
    message: "At least one field must be provided for update",
  }
);

export const schedulePostIdSchema = z.object({
  postId: z
    .string()
    .min(1, "Post ID is required")
    .refine(
      (val) => val.includes("_"),
      "Invalid post ID format. Expected format: scheduleId_index"
    ),
});

export const scheduleIdSchema = z.object({
  scheduleId: z.string().min(1, "Schedule ID is required"),
});

