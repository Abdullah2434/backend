// ==================== SUBSCRIPTION MODULE TYPES ====================

import { Request } from "express";
import Stripe from "stripe";

// ==================== REQUEST TYPES ====================

export interface SubscriptionRequest extends Request {
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateSubscriptionRequest extends Request {
  body: {
    planId: string;
    paymentMethodId?: string;
    couponCode?: string;
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface CancelSubscriptionRequest extends Request {
  body: {
    reason?: string;
    immediate?: boolean;
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface ChangePlanRequest extends Request {
  body: {
    newPlanId: string;
    prorationBehavior?: "create_prorations" | "none" | "always_invoice";
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreatePaymentIntentRequest extends Request {
  body: {
    amount: number;
    currency?: string;
    paymentMethodId?: string;
    description?: string;
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface ConfirmPaymentIntentRequest extends Request {
  body: {
    paymentIntentId: string;
    paymentMethodId?: string;
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface PaymentIntentStatusRequest extends Request {
  params: {
    id: string;
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// ==================== RESPONSE TYPES ====================

export interface SubscriptionResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface PlansResponse {
  success: boolean;
  message: string;
  data: {
    plans: SubscriptionPlan[];
  };
}

export interface CurrentSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    subscription: UserSubscription | null;
    isAuthenticated: boolean;
  };
}

export interface CreateSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    subscription: UserSubscription;
    clientSecret?: string;
  };
}

export interface CancelSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    subscription: UserSubscription;
  };
}

export interface PaymentIntentResponse {
  success: boolean;
  message: string;
  data: {
    paymentIntent: {
      id: string;
      clientSecret: string;
      status: string;
      amount: number;
      currency: string;
    };
  };
}

export interface BillingHistoryResponse {
  success: boolean;
  message: string;
  data: {
    billingHistory: BillingRecord[];
    total: number;
  };
}

export interface BillingSummaryResponse {
  success: boolean;
  message: string;
  data: {
    summary: BillingSummary;
  };
}

// ==================== SUBSCRIPTION DATA TYPES ====================

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in cents
  videoLimit: number;
  stripePriceId: string;
  features: string[];
  description?: string;
  interval?: "month" | "year";
  trialDays?: number;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  status:
    | "active"
    | "canceled"
    | "past_due"
    | "unpaid"
    | "incomplete"
    | "trialing";
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  trialStart?: string;
  trialEnd?: string;
  videoCount: number;
  videoLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionData {
  userId: string;
  planId: string;
  paymentMethodId?: string;
  couponCode?: string;
  trialDays?: number;
}

export interface UpdateSubscriptionData {
  planId?: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
}

export interface PaymentMethodData {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

export interface CreatePaymentIntentData {
  userId: string;
  amount: number;
  currency: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, string>;
}

// Original implementation interface for backward compatibility
export interface CreatePaymentIntentDataOriginal {
  userId: string;
  planId: string;
  customerEmail: string;
  customerName: string;
}

export interface BillingRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  stripeInvoiceId?: string;
  stripePaymentIntentId?: string;
  createdAt: string;
  paidAt?: string;
}

export interface BillingSummary {
  totalPaid: number;
  totalPending: number;
  totalFailed: number;
  currency: string;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  activeSubscriptions: number;
}

// ==================== CONFIGURATION TYPES ====================

export interface SubscriptionConfig {
  stripeSecretKey: string;
  stripePublishableKey: string;
  webhookSecret: string;
  apiVersion: string;
  currency: string;
  plans: SubscriptionPlan[];
  trialDays: number;
  gracePeriodDays: number;
  rateLimitWindow: number;
  rateLimitMax: number;
}

// ==================== ERROR TYPES ====================

export class SubscriptionError extends Error {
  statusCode: number;
  code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "SUBSCRIPTION_ERROR"
  ) {
    super(message);
    this.name = "SubscriptionError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends SubscriptionError {
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

export class AuthenticationError extends SubscriptionError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends SubscriptionError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends SubscriptionError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND_ERROR");
  }
}

export class RateLimitError extends SubscriptionError {
  constructor(message: string = "Too many requests. Please try again later.") {
    super(message, 429, "RATE_LIMIT_ERROR");
  }
}

export class StripeError extends SubscriptionError {
  constructor(message: string = "Stripe operation failed") {
    super(message, 502, "STRIPE_ERROR");
  }
}

export class PlanError extends SubscriptionError {
  constructor(message: string = "Invalid subscription plan") {
    super(message, 400, "PLAN_ERROR");
  }
}

export class PaymentError extends SubscriptionError {
  constructor(message: string = "Payment processing failed") {
    super(message, 402, "PAYMENT_ERROR");
  }
}

// ==================== UTILITY TYPES ====================

export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  totalRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
}

export interface SubscriptionAnalytics {
  subscriptionsByPlan: Array<{
    planId: string;
    planName: string;
    count: number;
    revenue: number;
  }>;
  subscriptionsByStatus: Array<{
    status: string;
    count: number;
  }>;
  monthlyRecurringRevenue: number;
  customerLifetimeValue: number;
}

export interface SubscriptionMiddlewareConfig {
  rateLimitWindow: number;
  rateLimitMax: number;
  enableLogging: boolean;
  enableAnalytics: boolean;
  requireAuth: boolean;
  allowGuestAccess: boolean;
}

// ==================== VALIDATION TYPES ====================

export interface SubscriptionValidationRules {
  planId: {
    required: boolean;
    pattern: RegExp;
  };
  paymentMethodId: {
    required: boolean;
    pattern: RegExp;
  };
  couponCode: {
    required: boolean;
    pattern: RegExp;
  };
  amount: {
    required: boolean;
    min: number;
    max: number;
  };
  currency: {
    required: boolean;
    pattern: RegExp;
  };
}

// ==================== STRIPE TYPES ====================

export interface StripeSubscriptionData {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_start?: number;
  trial_end?: number;
  items: {
    data: Array<{
      price: {
        id: string;
        unit_amount: number;
        currency: string;
        recurring: {
          interval: string;
        };
      };
    }>;
  };
}

export interface StripeCustomerData {
  id: string;
  email?: string;
  name?: string;
  metadata: Record<string, string>;
  subscriptions?: {
    data: StripeSubscriptionData[];
  };
}

export interface StripeInvoiceData {
  id: string;
  subscription?: string;
  payment_intent?: string;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: string;
}

export interface StripePaymentIntentData {
  id: string;
  customer?: string;
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
}

// ==================== WEBHOOK TYPES ====================

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

export interface SubscriptionWebhookData {
  subscriptionId: string;
  customerId: string;
  status: string;
  planId?: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  canceledAt?: number;
  trialStart?: number;
  trialEnd?: number;
}

// ==================== EXPORT ALL TYPES ====================
