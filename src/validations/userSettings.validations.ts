import { z } from "zod";

// ==================== USER SETTINGS VALIDATIONS ====================

export const getUserVideoSettingsSchema = z.object({
  email: z.string().email("Email must be a valid email address").min(1, "Email is required"),
});

export const avatarObjectSchema = z.union([
  z.object({
    avatar_id: z.string().min(1, "Avatar ID is required"),
    avatarType: z.string().min(1, "Avatar type is required"),
  }),
  z.string().min(1, "Avatar ID is required"), // Backward compatibility: string treated as avatar_id
]);

export const avatarArraySchema = z.union([
  z.array(z.string()),
  z.string().transform((val) => {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [val];
    }
  }),
  z.record(z.string()).transform((val) => Object.values(val)),
]);

export const saveUserVideoSettingsSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  avatar: avatarArraySchema.refine(
    (val) => Array.isArray(val) && val.length > 0,
    "Avatar must be a non-empty array"
  ),
  titleAvatar: avatarObjectSchema,
  conclusionAvatar: avatarObjectSchema,
  bodyAvatar: avatarObjectSchema.optional(),
  name: z.string().min(1, "Name is required"),
  position: z.string().min(1, "Position is required"),
  companyName: z.string().min(1, "Company name is required"),
  license: z.string().min(1, "License is required"),
  tailoredFit: z.string().min(1, "Tailored fit is required"),
  socialHandles: z.string().min(1, "Social handles is required"),
  city: z.string().min(1, "City is required"),
  preferredTone: z.string().min(1, "Preferred tone is required"),
  callToAction: z.string().min(1, "Call to action is required"),
  gender: z.enum(["male", "female"]).optional(),
  language: z.string().optional(),
  email: z.string().email("Email must be a valid email address").min(1, "Email is required"),
  selectedVoiceId: z.string().optional(),
  selectedMusicTrackId: z.string().optional(),
  preset: z.string().optional(),
  selectedVoicePreset: z.string().optional(),
  selectedMusicPreset: z.string().optional(),
});

