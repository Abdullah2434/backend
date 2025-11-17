import { z } from "zod";

// ==================== SOCIALBU MEDIA VALIDATIONS ====================

export const uploadMediaSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mime_type: z.string().min(1, "Mime type is required"),
  videoUrl: z.string().url("Video URL must be a valid URL").optional(),
});

export const mediaIdParamSchema = z.object({
  mediaId: z.string().min(1, "Media ID is required"),
});

export const updateMediaStatusSchema = z.object({
  status: z.enum(["uploaded", "failed"], {
    errorMap: () => ({ message: 'Status must be either "uploaded" or "failed"' }),
  }),
  errorMessage: z.string().optional(),
});

export const createSocialPostSchema = z.object({
  accountIds: z.union([
    z.array(z.number()),
    z.string(),
    z.number(),
    z.record(z.number()),
  ]),
  name: z.string().min(1, "Name is required"),
  userId: z.string().optional(), // Optional since we get it from auth
  videoUrl: z.string().url("Video URL must be a valid URL").min(1, "Video URL is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  caption: z.string().min(1, "Caption is required"),
  selectedAccounts: z.union([
    z.array(z.any()),
    z.record(z.any()),
  ]).optional(),
  instagram_caption: z.string().optional(),
  facebook_caption: z.string().optional(),
  linkedin_caption: z.string().optional(),
  twitter_caption: z.string().optional(),
  tiktok_caption: z.string().optional(),
  youtube_caption: z.string().optional(),
}).refine(
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
    message: "Account IDs array is required and must contain at least one account",
  }
).refine(
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

