import { z } from "zod";

export const getUserVideoSettingsSchema = z.object({
  query: z.object({
    email: z.string().email("Valid email is required"),
  }),
});

export const saveUserVideoSettingsSchema = z.object({
  body: z.object({
    prompt: z.string().min(1, "Prompt is required").trim(),
    avatar: z
      .union([
        z.array(z.string()),
        z.string().transform((val) => {
          try {
            return JSON.parse(val);
          } catch {
            throw new Error("Avatar must be a valid JSON array");
          }
        }),
      ])
      .refine((val) => Array.isArray(val) && val.length > 0, {
        message: "Avatar must be a non-empty array",
      }),
    titleAvatar: z.string().min(1, "Title avatar is required").trim(),
    conclusionAvatar: z.string().min(1, "Conclusion avatar is required").trim(),
    name: z.string().min(1, "Name is required").trim(),
    position: z.string().min(1, "Position is required").trim(),
    companyName: z.string().min(1, "Company name is required").trim(),
    license: z.string().min(1, "License is required").trim(),
    tailoredFit: z.string().min(1, "Tailored fit is required").trim(),
    socialHandles: z.string().min(1, "Social handles is required").trim(),
    city: z.string().min(1, "City is required").trim(),
    preferredTone: z.string().min(1, "Preferred tone is required").trim(),
    callToAction: z.string().min(1, "Call to action is required").trim(),
    email: z.string().email("Valid email is required"),
  }),
});
