import {
  body,
  param,
  ValidationChain,
  validationResult,
} from "express-validator";
import { Request, Response, NextFunction } from "express";
import { PaymentResponse } from "../types/payment.types";

// ==================== VALIDATION RULES ====================

// Payment Method ID validation
const paymentMethodIdValidation = param("paymentMethodId")
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage(
    "Payment method ID is required and must be less than 100 characters"
  )
  .matches(/^pm_[a-zA-Z0-9_]+$/)
  .withMessage("Payment method ID must be a valid Stripe payment method ID");

// Setup Intent ID validation
const setupIntentIdValidation = body("setupIntentId")
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage(
    "Setup intent ID is required and must be less than 100 characters"
  )
  .matches(/^seti_[a-zA-Z0-9_]+$/)
  .withMessage("Setup intent ID must be a valid Stripe setup intent ID");

// Return URL validation
const returnUrlValidation = body("returnUrl")
  .optional()
  .isURL()
  .withMessage("Return URL must be a valid URL")
  .customSanitizer((value) => sanitizeUrl(value));

// ==================== VALIDATION CHAINS ====================

export const validateCreateSetupIntent: ValidationChain[] = [
  returnUrlValidation,
];

export const validateUpdatePaymentMethod: ValidationChain[] = [
  setupIntentIdValidation,
];

export const validateSetDefaultPaymentMethod: ValidationChain[] = [
  paymentMethodIdValidation,
];

export const validateRemovePaymentMethod: ValidationChain[] = [
  paymentMethodIdValidation,
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

    const response: PaymentResponse = {
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

export const sanitizeUrl = (url: string): string => {
  return url.trim();
};

// ==================== CUSTOM VALIDATORS ====================

export const validatePaymentMethodId = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^pm_[a-zA-Z0-9_]+$/.test(trimmed);
};

export const validateSetupIntentId = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^seti_[a-zA-Z0-9_]+$/.test(trimmed);
};

export const validateReturnUrl = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

// ==================== VALIDATION UTILITIES ====================

export const validatePaymentData = (
  data: any
): {
  isValid: boolean;
  errors: Array<{ field: string; message: string; value?: any }>;
} => {
  const errors: Array<{ field: string; message: string; value?: any }> = [];

  if (data.paymentMethodId && !validatePaymentMethodId(data.paymentMethodId)) {
    errors.push({
      field: "paymentMethodId",
      message: "Payment method ID must be a valid Stripe payment method ID",
      value: data.paymentMethodId,
    });
  }

  if (data.setupIntentId && !validateSetupIntentId(data.setupIntentId)) {
    errors.push({
      field: "setupIntentId",
      message: "Setup intent ID must be a valid Stripe setup intent ID",
      value: data.setupIntentId,
    });
  }

  if (data.returnUrl && !validateReturnUrl(data.returnUrl)) {
    errors.push({
      field: "returnUrl",
      message: "Return URL must be a valid URL",
      value: data.returnUrl,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ==================== EXPORT ALL VALIDATION FUNCTIONS ====================

export {
  paymentMethodIdValidation,
  setupIntentIdValidation,
  returnUrlValidation,
};
