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
  size: z.string().optional(),
  bedroomCount: z.string().optional(),
  bathroomCount: z.string().optional(),
  lotSize: z.string().optional(),
  preferredTone: z.string().optional(),
  // Accept array or string (JSON or comma-separated); we normalize in controller
  types: z.union([z.array(z.string().min(1)), z.string()]).optional(),
});

export type PropertyImagesPayload = z.infer<typeof propertyImagesSchema>;

export const propertyWebhookSchema = z.object({
  images: z
    .array(
      z.object({
        type: z.string().min(1),
        imageurl: z.string().url(),
      })
    )
    .min(1),
  webhookResponse: z
    .array(
      z.object({
        text: z.string(),
      })
    )
    .optional(),
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
  useMusic: z.union([z.boolean(), z.string()]).optional(),
});

export type PropertyWebhookPayload = z.infer<typeof propertyWebhookSchema>;

export const tourVideoSchema = z.object({
  title: z.string().min(1),
  propertyType: z.string().min(1),
  price: z.string().min(1),
  size: z.string().min(1),
  bedRoomCount: z.string().min(1),
  bathRoomCount: z.string().min(1),
  social_handles: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  timestamp: z.string().datetime(),
  music: z.string().url(),
  mainSellingPoints: z.array(z.string()).optional(),
});

export type TourVideoPayload = z.infer<typeof tourVideoSchema>;
