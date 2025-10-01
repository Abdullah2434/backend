import { body, query, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { TrendsResponse } from "../types/trends.types";

// ==================== VALIDATION MIDDLEWARE ====================

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.type === "field" ? (error as any).path : "unknown",
      message: error.msg,
    }));

    const response: TrendsResponse = {
      success: false,
      message: "Validation failed",
      error: errorMessages.map((e) => e.message).join(", "),
    } as any;

    res.status(400).json(response);
    return;
  }

  next();
};

// ==================== TREND GENERATION VALIDATION ====================

export const validateTrendGeneration = [
  body("topic")
    .notEmpty()
    .withMessage("Topic is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Topic must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "Topic can only contain letters, numbers, spaces, hyphens, and underscores"
    )
    .trim(),
  body("location")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Location must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_,]+$/)
    .withMessage(
      "Location can only contain letters, numbers, spaces, hyphens, underscores, and commas"
    )
    .trim(),
  body("category")
    .optional()
    .isIn([
      "real_estate",
      "technology",
      "finance",
      "healthcare",
      "education",
      "entertainment",
      "sports",
      "politics",
      "environment",
      "business",
    ])
    .withMessage(
      "Category must be one of: real_estate, technology, finance, healthcare, education, entertainment, sports, politics, environment, business"
    ),
  body("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  body("filters")
    .optional()
    .isObject()
    .withMessage("Filters must be an object"),
  handleValidationErrors,
];

// ==================== QUERY VALIDATION ====================

export const validateTrendQuery = [
  query("topic")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Topic must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "Topic can only contain letters, numbers, spaces, hyphens, and underscores"
    )
    .trim(),
  query("location")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Location must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_,]+$/)
    .withMessage(
      "Location can only contain letters, numbers, spaces, hyphens, underscores, and commas"
    )
    .trim(),
  query("category")
    .optional()
    .isIn([
      "real_estate",
      "technology",
      "finance",
      "healthcare",
      "education",
      "entertainment",
      "sports",
      "politics",
      "environment",
      "business",
    ])
    .withMessage(
      "Category must be one of: real_estate, technology, finance, healthcare, education, entertainment, sports, politics, environment, business"
    ),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  handleValidationErrors,
];

// ==================== UTILITY VALIDATION FUNCTIONS ====================

export const isValidTopic = (topic: string): boolean => {
  return (
    /^[a-zA-Z0-9\s\-_]+$/.test(topic) &&
    topic.length >= 2 &&
    topic.length <= 100
  );
};

export const isValidLocation = (location: string): boolean => {
  return (
    /^[a-zA-Z0-9\s\-_,]+$/.test(location) &&
    location.length >= 2 &&
    location.length <= 100
  );
};

export const isValidCategory = (category: string): boolean => {
  const validCategories = [
    "real_estate",
    "technology",
    "finance",
    "healthcare",
    "education",
    "entertainment",
    "sports",
    "politics",
    "environment",
    "business",
  ];
  return validCategories.includes(category);
};

export const isValidLimit = (limit: number): boolean => {
  return Number.isInteger(limit) && limit >= 1 && limit <= 100;
};

// ==================== SANITIZATION FUNCTIONS ====================

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, "").replace(/\s+/g, " ");
};

export const sanitizeObject = (obj: any): any => {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
};

// ==================== VALIDATION RULES ====================

export const validationRules = {
  topic: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_]+$/,
    message:
      "Topic must be between 2 and 100 characters and contain only letters, numbers, spaces, hyphens, and underscores",
  },
  location: {
    required: false,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_,]+$/,
    message:
      "Location must be between 2 and 100 characters and contain only letters, numbers, spaces, hyphens, underscores, and commas",
  },
  category: {
    required: false,
    allowedValues: [
      "real_estate",
      "technology",
      "finance",
      "healthcare",
      "education",
      "entertainment",
      "sports",
      "politics",
      "environment",
      "business",
    ],
    message: "Category must be one of the allowed values",
  },
  limit: {
    required: false,
    min: 1,
    max: 100,
    type: "integer",
    message: "Limit must be an integer between 1 and 100",
  },
};

// ==================== VALIDATION HELPER FUNCTIONS ====================

export const validateField = (
  field: string,
  value: any,
  rules: any
): string[] => {
  const errors: string[] = [];

  if (rules.required && (!value || value === "")) {
    errors.push(`${field} is required`);
    return errors;
  }

  if (value !== undefined && value !== null && value !== "") {
    if (
      rules.minLength &&
      typeof value === "string" &&
      value.length < rules.minLength
    ) {
      errors.push(
        `${field} must be at least ${rules.minLength} characters long`
      );
    }

    if (
      rules.maxLength &&
      typeof value === "string" &&
      value.length > rules.maxLength
    ) {
      errors.push(
        `${field} must be no more than ${rules.maxLength} characters long`
      );
    }

    if (
      rules.pattern &&
      typeof value === "string" &&
      !rules.pattern.test(value)
    ) {
      errors.push(rules.message || `${field} format is invalid`);
    }

    if (rules.min && typeof value === "number" && value < rules.min) {
      errors.push(`${field} must be at least ${rules.min}`);
    }

    if (rules.max && typeof value === "number" && value > rules.max) {
      errors.push(`${field} must be no more than ${rules.max}`);
    }

    if (rules.type && typeof value !== rules.type) {
      errors.push(`${field} must be of type ${rules.type}`);
    }

    if (rules.allowedValues && !rules.allowedValues.includes(value)) {
      errors.push(`${field} must be one of: ${rules.allowedValues.join(", ")}`);
    }
  }

  return errors;
};

export const validateTrendRequest = (
  data: any
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validate topic
  const topicErrors = validateField("topic", data.topic, validationRules.topic);
  errors.push(...topicErrors);

  // Validate location
  if (data.location) {
    const locationErrors = validateField(
      "location",
      data.location,
      validationRules.location
    );
    errors.push(...locationErrors);
  }

  // Validate category
  if (data.category) {
    const categoryErrors = validateField(
      "category",
      data.category,
      validationRules.category
    );
    errors.push(...categoryErrors);
  }

  // Validate limit
  if (data.limit) {
    const limitErrors = validateField(
      "limit",
      data.limit,
      validationRules.limit
    );
    errors.push(...limitErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
