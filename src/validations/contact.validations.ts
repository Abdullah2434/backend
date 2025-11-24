import { z } from "zod";
import { ValidationError } from "../types";

/**
 * Contact form validation schema
 */
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

/**
 * Type inference for contact form data
 */
export type ContactFormData = z.infer<typeof contactFormSchema>;

/**
 * Validation result interface
 */
export interface ContactFormValidationResult {
  success: boolean;
  data?: ContactFormData;
  errors?: ValidationError[];
}

/**
 * Validate contact form data
 * @param data - The data to validate
 * @returns Validation result with either validated data or errors
 */
export function validateContactForm(
  data: unknown
): ContactFormValidationResult {
  const validationResult = contactFormSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

