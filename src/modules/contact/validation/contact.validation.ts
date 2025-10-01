import { body, ValidationChain, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { ContactResponse, ValidationErrorData } from "../types/contact.types";

// ==================== VALIDATION RULES ====================

// Full name validation
const fullNameValidation = body("fullName")
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage("Full name must be between 1 and 100 characters")
  .matches(/^[a-zA-Z\s'-]+$/)
  .withMessage(
    "Full name can only contain letters, spaces, hyphens, and apostrophes"
  )
  .customSanitizer((value) => sanitizeName(value));

// Position validation
const positionValidation = body("position")
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage("Position/Title must be between 1 and 100 characters")
  .matches(/^[a-zA-Z0-9\s&.,-]+$/)
  .withMessage("Position/Title contains invalid characters")
  .customSanitizer((value) => sanitizePosition(value));

// Email validation
const emailValidation = body("email")
  .isEmail()
  .withMessage("Please provide a valid email address")
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage("Email must be less than 255 characters")
  .customSanitizer((value) => sanitizeEmail(value));

// Phone validation
const phoneValidation = body("phone")
  .trim()
  .isLength({ min: 10, max: 20 })
  .withMessage("Phone number must be between 10 and 20 characters")
  .matches(/^[\+]?[1-9][\d]{0,15}$/)
  .withMessage("Please provide a valid phone number")
  .customSanitizer((value) => sanitizePhone(value));

// Question validation
const questionValidation = body("question")
  .trim()
  .isLength({ min: 10, max: 2000 })
  .withMessage("Question must be between 10 and 2000 characters")
  .matches(
    /^[a-zA-Z0-9\s\?\!\.\,\;\:\-\(\)\[\]\{\}\"\'\/\\\@\#\$\%\^\&\*\+\=\<\>\|`~]+$/
  )
  .withMessage("Question contains invalid characters")
  .customSanitizer((value) => sanitizeQuestion(value));

// ==================== VALIDATION CHAINS ====================

export const validateContactForm: ValidationChain[] = [
  fullNameValidation,
  positionValidation,
  emailValidation,
  phoneValidation,
  questionValidation,
];

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

    const response: ContactResponse = {
      success: false,
      message: "Validation failed",
      data: { errors: formattedErrors },
    };

    res.status(400).json(response);
    return;
  }

  next();
};

// ==================== SANITIZATION FUNCTIONS ====================

export const sanitizeName = (name: string): string => {
  return name
    .trim()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/[^a-zA-Z\s'-]/g, "") // Remove invalid characters
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const sanitizePosition = (position: string): string => {
  return position
    .trim()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/[^a-zA-Z0-9\s&.,-]/g, ""); // Remove invalid characters
};

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const sanitizePhone = (phone: string): string => {
  return phone.replace(/\D/g, ""); // Keep only digits
};

export const sanitizeQuestion = (question: string): string => {
  return question
    .trim()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(
      /[^\w\s\?\!\.\,\;\:\-\(\)\[\]\{\}\"\'\/\\\@\#\$\%\^\&\*\+\=\<\>\|`~]/g,
      ""
    ); // Remove invalid characters
};

// ==================== CUSTOM VALIDATORS ====================

export const validateFullName = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^[a-zA-Z\s'-]+$/.test(trimmed);
};

export const validatePosition = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^[a-zA-Z0-9\s&.,-]+$/.test(trimmed);
};

export const validateEmail = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) && value.length <= 255;
};

export const validatePhone = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(value) && value.length >= 10 && value.length <= 20;
};

export const validateQuestion = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 10 || trimmed.length > 2000) return false;
  return /^[a-zA-Z0-9\s\?\!\.\,\;\:\-\(\)\[\]\{\}\"\'\/\\\@\#\$\%\^\&\*\+\=\<\>\|`~]+$/.test(
    trimmed
  );
};

// ==================== VALIDATION UTILITIES ====================

export const validateContactFormData = (
  data: any
): {
  isValid: boolean;
  errors: ValidationErrorData[];
} => {
  const errors: ValidationErrorData[] = [];

  if (!validateFullName(data.fullName)) {
    errors.push({
      field: "fullName",
      message:
        "Full name must be between 1 and 100 characters and contain only letters, spaces, hyphens, and apostrophes",
      value: data.fullName,
    });
  }

  if (!validatePosition(data.position)) {
    errors.push({
      field: "position",
      message:
        "Position/Title must be between 1 and 100 characters and contain only valid characters",
      value: data.position,
    });
  }

  if (!validateEmail(data.email)) {
    errors.push({
      field: "email",
      message: "Please provide a valid email address",
      value: data.email,
    });
  }

  if (!validatePhone(data.phone)) {
    errors.push({
      field: "phone",
      message: "Please provide a valid phone number",
      value: data.phone,
    });
  }

  if (!validateQuestion(data.question)) {
    errors.push({
      field: "question",
      message:
        "Question must be between 10 and 2000 characters and contain only valid characters",
      value: data.question,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ==================== EXPORT ALL VALIDATION FUNCTIONS ====================

export {
  fullNameValidation,
  positionValidation,
  emailValidation,
  phoneValidation,
  questionValidation,
};
