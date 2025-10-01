// ==================== PAYMENT MODULE TYPES ====================

import { Request } from "express";
import Stripe from "stripe";

// ==================== REQUEST TYPES ====================

export interface PaymentMethodsRequest extends Request {
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateSetupIntentRequest extends Request {
  body: {
    returnUrl?: string;
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface UpdatePaymentMethodRequest extends Request {
  body: {
    setupIntentId: string;
    paymentMethodId?: string;
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface SetDefaultPaymentMethodRequest extends Request {
  params: {
    paymentMethodId: string;
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface RemovePaymentMethodRequest extends Request {
  params: {
    paymentMethodId: string;
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// ==================== RESPONSE TYPES ====================

export interface PaymentResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface PaymentMethodsResponse {
  success: boolean;
  message: string;
  data: {
    paymentMethods: PaymentMethod[];
    count: number;
  };
}

export interface SetupIntentResponse {
  success: boolean;
  message: string;
  data: {
    clientSecret: string;
    setupIntentId: string;
  };
}

export interface UpdatePaymentMethodResponse {
  success: boolean;
  message: string;
  data: {
    paymentMethod: PaymentMethod;
  };
}

export interface SetDefaultResponse {
  success: boolean;
  message: string;
  data: {
    paymentMethod: PaymentMethod;
  };
}

export interface RemovePaymentMethodResponse {
  success: boolean;
  message: string;
}

// ==================== PAYMENT DATA TYPES ====================

export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
  createdAt: string;
}

export interface SetupIntentData {
  setupIntentId: string;
  clientSecret: string;
  returnUrl?: string;
}

export interface CardInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface CustomerData {
  id: string;
  email: string;
  name: string;
  metadata: {
    userId: string;
  };
}

// ==================== CONFIGURATION TYPES ====================

export interface PaymentConfig {
  stripeSecretKey: string;
  stripePublishableKey: string;
  webhookSecret: string;
  apiVersion: string;
  currency: string;
  returnUrl: string;
  rateLimitWindow: number;
  rateLimitMax: number;
}

// ==================== ERROR TYPES ====================

export class PaymentError extends Error {
  statusCode: number;
  code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "PAYMENT_ERROR"
  ) {
    super(message);
    this.name = "PaymentError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends PaymentError {
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

export class AuthenticationError extends PaymentError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends PaymentError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends PaymentError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND_ERROR");
  }
}

export class RateLimitError extends PaymentError {
  constructor(message: string = "Too many requests. Please try again later.") {
    super(message, 429, "RATE_LIMIT_ERROR");
  }
}

export class StripeError extends PaymentError {
  constructor(message: string = "Stripe operation failed") {
    super(message, 502, "STRIPE_ERROR");
  }
}

// ==================== UTILITY TYPES ====================

export interface PaymentStats {
  totalPaymentMethods: number;
  defaultPaymentMethod?: PaymentMethod;
  lastUpdated: string;
}

export interface PaymentAnalytics {
  paymentMethodsByType: Array<{
    type: string;
    count: number;
  }>;
  mostUsedBrand: string;
  averageExpiryMonths: number;
}

export interface PaymentMiddlewareConfig {
  rateLimitWindow: number;
  rateLimitMax: number;
  enableLogging: boolean;
  enableAnalytics: boolean;
  requireAuth: boolean;
}

// ==================== VALIDATION TYPES ====================

export interface PaymentValidationRules {
  paymentMethodId: {
    required: boolean;
    pattern: RegExp;
  };
  setupIntentId: {
    required: boolean;
    pattern: RegExp;
  };
  returnUrl: {
    required: boolean;
    pattern: RegExp;
  };
}

// ==================== STRIPE TYPES ====================

export interface StripeSetupIntent extends Stripe.SetupIntent {
  client_secret: string;
}

export interface StripePaymentMethod extends Stripe.PaymentMethod {
  card?: Stripe.PaymentMethod.Card;
}

export interface StripeCustomer extends Stripe.Customer {
  metadata: {
    userId: string;
  };
}
