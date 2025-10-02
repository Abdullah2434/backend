import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email format"),
    phone: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const googleLoginSchema = z.object({
  body: z.object({
    googleId: z.string().min(1, "Google ID is required"),
    email: z.string().email("Invalid email format"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    resetToken: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  }),
});

export const validateTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
  }),
});

export const checkEmailSchema = z.object({
  query: z.object({
    email: z.string().email("Invalid email format"),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().optional(),
  }),
});
