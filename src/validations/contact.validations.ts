import { z } from "zod";

// ==================== CONTACT FORM VALIDATIONS ====================

export const contactFormSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full Name is required")
    .max(100, "Full Name too long"),
  position: z
    .string()
    .min(1, "Position/Title is required")
    .max(100, "Position/Title too long"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .max(20, "Phone number too long"),
  question: z
    .string()
    .min(10, "Question must be at least 10 characters")
    .max(2000, "Question too long"),
});

