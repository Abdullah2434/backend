// ==================== CONTACT MODULE TYPES ====================

import { Request } from "express";

// ==================== REQUEST TYPES ====================

export interface ContactFormRequest extends Request {
  body: {
    fullName: string;
    position: string;
    email: string;
    phone: string;
    question: string;
  };
}

// ==================== RESPONSE TYPES ====================

export interface ContactResponse {
  success: boolean;
  message: string;
  data?: {
    submissionId?: string;
    timestamp?: string;
    errors?: ValidationErrorData[];
  };
}

export interface ValidationErrorData {
  field: string;
  message: string;
  value?: any;
}

// ==================== CONTACT DATA TYPES ====================

export interface ContactFormData {
  fullName: string;
  position: string;
  email: string;
  phone: string;
  question: string;
}

export interface ContactSubmissionResult {
  success: boolean;
  message: string;
  submissionId?: string;
  timestamp: string;
}

// ==================== EMAIL TYPES ====================

export interface ContactEmailData {
  fullName: string;
  position: string;
  email: string;
  phone: string;
  question: string;
  adminEmail: string;
}

export interface ContactConfirmationData {
  email: string;
  fullName: string;
  question: string;
}

// ==================== CONFIGURATION TYPES ====================

export interface ContactConfig {
  adminEmail: string;
  contactEmail: string;
  rateLimitWindow: number;
  rateLimitMax: number;
  maxQuestionLength: number;
  maxNameLength: number;
  maxPositionLength: number;
  maxPhoneLength: number;
}

// ==================== ERROR TYPES ====================

export class ContactError extends Error {
  statusCode: number;
  code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "CONTACT_ERROR"
  ) {
    super(message);
    this.name = "ContactError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends ContactError {
  field?: string;

  constructor(
    message: string,
    field?: string,
    statusCode: number = 400,
    code: string = "VALIDATION_ERROR"
  ) {
    super(message, statusCode, code);
    this.field = field;
  }
}

export class EmailError extends ContactError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, "EMAIL_ERROR");
  }
}

export class RateLimitError extends ContactError {
  constructor(
    message: string = "Too many contact form submissions. Please try again later."
  ) {
    super(message, 429, "RATE_LIMIT_ERROR");
  }
}

// ==================== UTILITY TYPES ====================

export interface ContactStats {
  totalSubmissions: number;
  submissionsToday: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
}

export interface ContactAnalytics {
  mostCommonQuestions: Array<{
    question: string;
    count: number;
  }>;
  submissionsByDay: Array<{
    date: string;
    count: number;
  }>;
  averageResponseTime: number;
}

// ==================== MIDDLEWARE TYPES ====================

export interface ContactMiddlewareConfig {
  rateLimitWindow: number;
  rateLimitMax: number;
  enableLogging: boolean;
  enableAnalytics: boolean;
}

// ==================== VALIDATION TYPES ====================

export interface ContactValidationRules {
  fullName: {
    required: boolean;
    minLength: number;
    maxLength: number;
    pattern?: RegExp;
  };
  position: {
    required: boolean;
    minLength: number;
    maxLength: number;
    pattern?: RegExp;
  };
  email: {
    required: boolean;
    pattern: RegExp;
    maxLength: number;
  };
  phone: {
    required: boolean;
    minLength: number;
    maxLength: number;
    pattern?: RegExp;
  };
  question: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
}
