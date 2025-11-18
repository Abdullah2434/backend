import { z } from "zod";

// ==================== WEBHOOK VALIDATIONS ====================

const VALID_AVATAR_STATUSES = ["completed", "failed"] as const;
const VALID_VIDEO_STATUSES = ["completed", "failed", "processing"] as const;

export const avatarWebhookSchema = z.object({
  avatar_id: z.string().min(1, "Avatar ID is required"),
  status: z.enum(VALID_AVATAR_STATUSES, {
    errorMap: () => ({
      message: 'Invalid status. Must be "completed" or "failed"',
    }),
  }),
  avatar_group_id: z.string().min(1, "Avatar group ID is required"),
  callback_id: z.string().optional(),
  user_id: z.string().optional(),
  webhook_url: z.string().url("Webhook URL must be a valid URL").optional(),
});

export const testWebhookSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
  status: z.string().optional(),
  s3Key: z.string().optional(),
  metadata: z.any().optional(),
  error: z.string().optional(),
  scheduleId: z.string().optional(),
  trendIndex: z.number().optional(),
  captions: z.any().optional(),
});

export const scheduledVideoCompleteSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
  status: z.string().optional(),
  s3Key: z.string().optional(),
  metadata: z.any().optional(),
  error: z.string().optional(),
  scheduleId: z.string().min(1, "Schedule ID is required"),
  trendIndex: z.number().int("Trend index must be an integer").min(0, "Trend index must be non-negative"),
  captions: z.any().optional(),
});

export const verifyWebhookSchema = z.object({
  payload: z.any().refine((val) => val !== undefined && val !== null, {
    message: "Payload is required",
  }),
  signature: z.string().min(1, "Signature is required"),
});

export const captionCompleteSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
  status: z.string().min(1, "Status is required"),
  email: z.string().email("Email must be a valid email address").optional(),
  title: z.string().optional(),
});

export const videoCompleteSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
  status: z.string().optional(),
  s3Key: z.string().optional(),
  metadata: z.any().optional(),
  error: z.string().optional(),
  scheduleId: z.string().optional(),
  trendIndex: z.number().optional(),
  captions: z.any().optional(),
});

export const handleWorkflowErrorSchema = z.object({
  errorMessage: z.string().min(1, "Error message is required"),
  executionId: z.string().min(1, "Execution ID is required"),
  scheduleId: z.string().optional(),
  trendIndex: z.number().int("Trend index must be an integer").optional(),
});

