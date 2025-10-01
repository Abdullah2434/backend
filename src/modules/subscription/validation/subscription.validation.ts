import {
  body,
  param,
  ValidationChain,
  validationResult,
} from "express-validator";
import { Request, Response, NextFunction } from "express";
import { SubscriptionResponse } from "../types/subscription.types";

// ==================== VALIDATION RULES ====================

// Plan ID validation
const planIdValidation = body("planId")
  .trim()
  .isLength({ min: 1, max: 50 })
  .withMessage("Plan ID is required and must be less than 50 characters")
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage(
    "Plan ID must contain only letters, numbers, hyphens, and underscores"
  );

// New Plan ID validation (for plan changes)
const newPlanIdValidation = body("newPlanId")
  .trim()
  .isLength({ min: 1, max: 50 })
  .withMessage("New plan ID is required and must be less than 50 characters")
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage(
    "New plan ID must contain only letters, numbers, hyphens, and underscores"
  );

// Payment Method ID validation
const paymentMethodIdValidation = body("paymentMethodId")
  .optional()
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage("Payment method ID must be less than 100 characters")
  .matches(/^pm_[a-zA-Z0-9_]+$/)
  .withMessage("Payment method ID must be a valid Stripe payment method ID");

// Payment Intent ID validation
const paymentIntentIdValidation = body("paymentIntentId")
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage(
    "Payment intent ID is required and must be less than 100 characters"
  )
  .matches(/^pi_[a-zA-Z0-9_]+$/)
  .withMessage("Payment intent ID must be a valid Stripe payment intent ID");

// Payment Intent ID from params
const paymentIntentIdParamValidation = param("id")
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage(
    "Payment intent ID is required and must be less than 100 characters"
  )
  .matches(/^pi_[a-zA-Z0-9_]+$/)
  .withMessage("Payment intent ID must be a valid Stripe payment intent ID");

// Amount validation
const amountValidation = body("amount")
  .isInt({ min: 50, max: 1000000 })
  .withMessage("Amount must be between 50 and 1,000,000 cents")
  .custom((value) => {
    if (value % 50 !== 0) {
      throw new Error("Amount must be in increments of 50 cents");
    }
    return true;
  });

// Currency validation
const currencyValidation = body("currency")
  .optional()
  .trim()
  .isLength({ min: 3, max: 3 })
  .withMessage("Currency must be exactly 3 characters")
  .matches(/^[A-Z]{3}$/)
  .withMessage("Currency must be a valid 3-letter currency code");

// Coupon code validation
const couponCodeValidation = body("couponCode")
  .optional()
  .trim()
  .isLength({ min: 1, max: 50 })
  .withMessage("Coupon code must be less than 50 characters")
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage(
    "Coupon code must contain only letters, numbers, hyphens, and underscores"
  );

// Description validation
const descriptionValidation = body("description")
  .optional()
  .trim()
  .isLength({ min: 1, max: 500 })
  .withMessage("Description must be less than 500 characters")
  .customSanitizer((value) => sanitizeString(value));

// Reason validation (for cancellation)
const reasonValidation = body("reason")
  .optional()
  .trim()
  .isLength({ min: 1, max: 200 })
  .withMessage("Reason must be less than 200 characters")
  .customSanitizer((value) => sanitizeString(value));

// Immediate cancellation validation
const immediateValidation = body("immediate")
  .optional()
  .isBoolean()
  .withMessage("Immediate must be a boolean value");

// Proration behavior validation
const prorationBehaviorValidation = body("prorationBehavior")
  .optional()
  .isIn(["create_prorations", "none", "always_invoice"])
  .withMessage(
    "Proration behavior must be one of: create_prorations, none, always_invoice"
  );

// ==================== VALIDATION CHAINS ====================

export const validateCreateSubscription: ValidationChain[] = [
  planIdValidation,
  paymentMethodIdValidation,
  couponCodeValidation,
];

export const validateCancelSubscription: ValidationChain[] = [
  reasonValidation,
  immediateValidation,
];

export const validateChangePlan: ValidationChain[] = [
  newPlanIdValidation,
  prorationBehaviorValidation,
];

export const validateCreatePaymentIntent: ValidationChain[] = [
  amountValidation,
  currencyValidation,
  paymentMethodIdValidation,
  descriptionValidation,
];

export const validateConfirmPaymentIntent: ValidationChain[] = [
  paymentIntentIdValidation,
  paymentMethodIdValidation,
];

export const validatePaymentIntentStatus: ValidationChain[] = [
  paymentIntentIdParamValidation,
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

    const response: SubscriptionResponse = {
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

export const sanitizeString = (str: string): string => {
  return str.trim();
};

// ==================== CUSTOM VALIDATORS ====================

export const validatePlanId = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 50) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
};

export const validatePaymentMethodId = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^pm_[a-zA-Z0-9_]+$/.test(trimmed);
};

export const validatePaymentIntentId = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^pi_[a-zA-Z0-9_]+$/.test(trimmed);
};

export const validateAmount = (value: number): boolean => {
  if (typeof value !== "number" || isNaN(value)) return false;
  if (value < 50 || value > 1000000) return false;
  return value % 50 === 0;
};

export const validateCurrency = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length !== 3) return false;
  return /^[A-Z]{3}$/.test(trimmed);
};

export const validateCouponCode = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 50) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
};

// ==================== VALIDATION UTILITIES ====================

export const validateSubscriptionData = (
  data: any
): {
  isValid: boolean;
  errors: Array<{ field: string; message: string; value?: any }>;
} => {
  const errors: Array<{ field: string; message: string; value?: any }> = [];

  if (data.planId && !validatePlanId(data.planId)) {
    errors.push({
      field: "planId",
      message:
        "Plan ID must contain only letters, numbers, hyphens, and underscores",
      value: data.planId,
    });
  }

  if (data.newPlanId && !validatePlanId(data.newPlanId)) {
    errors.push({
      field: "newPlanId",
      message:
        "New plan ID must contain only letters, numbers, hyphens, and underscores",
      value: data.newPlanId,
    });
  }

  if (data.paymentMethodId && !validatePaymentMethodId(data.paymentMethodId)) {
    errors.push({
      field: "paymentMethodId",
      message: "Payment method ID must be a valid Stripe payment method ID",
      value: data.paymentMethodId,
    });
  }

  if (data.paymentIntentId && !validatePaymentIntentId(data.paymentIntentId)) {
    errors.push({
      field: "paymentIntentId",
      message: "Payment intent ID must be a valid Stripe payment intent ID",
      value: data.paymentIntentId,
    });
  }

  if (data.amount && !validateAmount(data.amount)) {
    errors.push({
      field: "amount",
      message:
        "Amount must be between 50 and 1,000,000 cents in increments of 50",
      value: data.amount,
    });
  }

  if (data.currency && !validateCurrency(data.currency)) {
    errors.push({
      field: "currency",
      message: "Currency must be a valid 3-letter currency code",
      value: data.currency,
    });
  }

  if (data.couponCode && !validateCouponCode(data.couponCode)) {
    errors.push({
      field: "couponCode",
      message:
        "Coupon code must contain only letters, numbers, hyphens, and underscores",
      value: data.couponCode,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ==================== EXPORT ALL VALIDATION FUNCTIONS ====================

export {
  planIdValidation,
  newPlanIdValidation,
  paymentMethodIdValidation,
  paymentIntentIdValidation,
  paymentIntentIdParamValidation,
  amountValidation,
  currencyValidation,
  couponCodeValidation,
  descriptionValidation,
  reasonValidation,
  immediateValidation,
  prorationBehaviorValidation,
};
