import { z } from "zod";

// ==================== VIDEO VALIDATIONS ====================

export const videoIdParamSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
});

export const updateVideoNoteSchema = z.object({
  note: z.string().nullable().optional(),
});

