import {
  body,
  query,
  ValidationChain,
  validationResult,
} from "express-validator";
import { Request, Response, NextFunction } from "express";
import { ValidationError, AuthResponse } from "../types/auth.types";

// ==================== VALIDATION RULES ====================

// Email validation
const emailValidation = body("email")
  .isEmail()
  .withMessage("Please provide a valid email address")
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage("Email must be less than 255 characters");

// Password validation
const passwordValidation = body("password")
  .isLength({ min: 8, max: 128 })
  .withMessage("Password must be between 8 and 128 characters")
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage(
    "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
  );

// Name validation
const nameValidation = (field: string) =>
  body(field)
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage(`${field} must be between 1 and 50 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      `${field} can only contain letters, spaces, hyphens, and apostrophes`
    );

// Phone validation
const phoneValidation = body("phone")
  .optional()
  .isMobilePhone("any")
  .withMessage("Please provide a valid phone number");

// Token validation
const tokenValidation = body("token")
  .notEmpty()
  .withMessage("Token is required")
  .isLength({ min: 10 })
  .withMessage("Token appears to be invalid");

// Query token validation
const queryTokenValidation = query("token")
  .notEmpty()
  .withMessage("Verification token is required")
  .isLength({ min: 10 })
  .withMessage("Token appears to be invalid");

// Query email validation
const queryEmailValidation = query("email")
  .isEmail()
  .withMessage("Please provide a valid email address")
  .normalizeEmail();

// ==================== VALIDATION CHAINS ====================

export const validateRegistration: ValidationChain[] = [
  nameValidation("firstName"),
  nameValidation("lastName"),
  emailValidation,
  phoneValidation,
  passwordValidation,
];

export const validateLogin: ValidationChain[] = [
  emailValidation,
  body("password").notEmpty().withMessage("Password is required"),
];

export const validateGoogleLogin: ValidationChain[] = [
  body("googleId")
    .notEmpty()
    .withMessage("Google ID is required")
    .isLength({ min: 10 })
    .withMessage("Invalid Google ID format"),
  emailValidation,
  nameValidation("firstName"),
  nameValidation("lastName"),
];

export const validateForgotPassword: ValidationChain[] = [emailValidation];

export const validateResetPassword: ValidationChain[] = [
  tokenValidation,
  passwordValidation,
];

export const validateProfileUpdate: ValidationChain[] = [
  nameValidation("firstName").optional(),
  nameValidation("lastName").optional(),
  phoneValidation,
];

export const validateEmailVerification: ValidationChain[] = [
  queryTokenValidation,
];

export const validateResendVerification: ValidationChain[] = [emailValidation];

export const validateEmailCheck: ValidationChain[] = [queryEmailValidation];

export const validateEmailVerificationCheck: ValidationChain[] = [
  emailValidation,
];

export const validateToken: ValidationChain[] = [tokenValidation];

export const validateResetToken: ValidationChain[] = [tokenValidation];

export const validateDebugPasswordHash: ValidationChain[] = [
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 1, max: 128 })
    .withMessage("Password must be between 1 and 128 characters"),
];

// ==================== CUSTOM VALIDATION FUNCTIONS ====================

export const validatePasswordStrength = (
  password: string
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (password.length < 8) {
    errors.push(
      new ValidationError(
        "Password must be at least 8 characters long",
        "password"
      )
    );
  }

  if (password.length > 128) {
    errors.push(
      new ValidationError(
        "Password must be less than 128 characters",
        "password"
      )
    );
  }

  if (!/[a-z]/.test(password)) {
    errors.push(
      new ValidationError(
        "Password must contain at least one lowercase letter",
        "password"
      )
    );
  }

  if (!/[A-Z]/.test(password)) {
    errors.push(
      new ValidationError(
        "Password must contain at least one uppercase letter",
        "password"
      )
    );
  }

  if (!/\d/.test(password)) {
    errors.push(
      new ValidationError(
        "Password must contain at least one number",
        "password"
      )
    );
  }

  if (!/[@$!%*?&]/.test(password)) {
    errors.push(
      new ValidationError(
        "Password must contain at least one special character (@$!%*?&)",
        "password"
      )
    );
  }

  // Check for common weak passwords
  const commonPasswords = [
    "password",
    "123456",
    "123456789",
    "qwerty",
    "abc123",
    "password123",
    "admin",
    "letmein",
    "welcome",
    "monkey",
    "1234567890",
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push(
      new ValidationError(
        "Password is too common, please choose a stronger password",
        "password"
      )
    );
  }

  return errors;
};

export const validateEmailFormat = (email: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    errors.push(
      new ValidationError("Please provide a valid email address", "email")
    );
  }

  if (email.length > 255) {
    errors.push(
      new ValidationError("Email must be less than 255 characters", "email")
    );
  }

  // Check for disposable email domains
  const disposableDomains = [
    "10minutemail.com",
    "tempmail.org",
    "guerrillamail.com",
    "mailinator.com",
    "temp-mail.org",
    "throwaway.email",
    "getnada.com",
    "maildrop.cc",
  ];

  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && disposableDomains.includes(domain)) {
    errors.push(
      new ValidationError("Disposable email addresses are not allowed", "email")
    );
  }

  return errors;
};

export const validateName = (
  name: string,
  field: string
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!name || name.trim().length === 0) {
    errors.push(new ValidationError(`${field} is required`, field));
    return errors;
  }

  if (name.length < 1) {
    errors.push(
      new ValidationError(`${field} must be at least 1 character long`, field)
    );
  }

  if (name.length > 50) {
    errors.push(
      new ValidationError(`${field} must be less than 50 characters`, field)
    );
  }

  if (!/^[a-zA-Z\s'-]+$/.test(name)) {
    errors.push(
      new ValidationError(
        `${field} can only contain letters, spaces, hyphens, and apostrophes`,
        field
      )
    );
  }

  return errors;
};

export const validatePhone = (phone: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!phone) {
    return errors; // Phone is optional
  }

  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, "");

  if (digitsOnly.length < 10) {
    errors.push(
      new ValidationError("Phone number must have at least 10 digits", "phone")
    );
  }

  if (digitsOnly.length > 15) {
    errors.push(
      new ValidationError("Phone number must have at most 15 digits", "phone")
    );
  }

  return errors;
};

// ==================== SANITIZATION FUNCTIONS ====================

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, ""); // Remove event handlers
};

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const sanitizeName = (name: string): string => {
  return name
    .trim()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/[^a-zA-Z\s'-]/g, ""); // Remove invalid characters
};

export const sanitizePhone = (phone: string): string => {
  return phone.replace(/\D/g, ""); // Keep only digits
};

// ==================== VALIDATION MIDDLEWARE ====================

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.type === "field" ? (error as any).path : "unknown",
      message: error.msg,
      value: error.type === "field" ? (error as any).value : undefined,
    }));

    const response: AuthResponse = {
      success: false,
      message: "Validation failed",
      data: { errors: formattedErrors },
    };

    res.status(400).json(response);
    return;
  }

  next();
};
