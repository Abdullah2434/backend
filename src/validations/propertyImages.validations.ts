import { z } from "zod";

export const propertyImagesSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  social_handles: z.string().optional(),
  propertyType: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  price: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  mainSellingPoints: z.array(z.string()).optional(),
  // Accept array or string (JSON or comma-separated); we normalize in controller
  types: z.union([z.array(z.string().min(1)), z.string()]).optional(),
});

export type PropertyImagesPayload = z.infer<typeof propertyImagesSchema>;

export const propertyWebhookSchema = z.object({
  images: z.array(
    z.object({
      type: z.string().min(1),
      imageurl: z.string().url(),
    })
  ).min(1),
  webhookResponse: z.array(
    z.object({
      text: z.string(),
    })
  ).optional(),
  email: z.string().email(),
  timestamp: z.string().datetime().optional(),
  name: z.string().min(1),
  social_handles: z.string().optional(),
  propertyType: z.string().optional(),
  avatar: z.string().min(1),
  avatarType: z.string().min(1).optional(),
  music: z.string().url(),
  videoCaption: z.boolean(),
  voiceId: z.string().min(1),
  title: z.string().min(1),
  videoType: z.string().optional().default("VideoListing"),
});

export type PropertyWebhookPayload = z.infer<typeof propertyWebhookSchema>;

