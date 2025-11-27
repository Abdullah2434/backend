/**
 * Constants specific to subscription service
 */

// ==================== DEFAULT VALUES ====================
export const DEFAULT_BILLING_HISTORY_LIMIT = 20;
export const DEFAULT_BILLING_HISTORY_OFFSET = 0;
export const DEFAULT_BILLING_PERIOD_DAYS = 30;
export const DEFAULT_PLAN_ID = "monthly";
export const DEFAULT_PLAN_NAME = "Monthly Plan";

// ==================== SUBSCRIPTION STATUS QUERIES ====================
export const ACTIVE_OR_PENDING_STATUSES = ["active", "pending"] as const;
export const INCOMPLETE_STATUSES = ["pending", "incomplete", "past_due"] as const;
export const ALL_SUBSCRIPTION_STATUSES = [
  "active",
  "pending",
  "incomplete",
  "past_due",
] as const;

// ==================== PAYMENT INTENT PREFIX ====================
export const PAYMENT_INTENT_PREFIX = "pi_";

// ==================== STRIPE CONFIGURATION ====================
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// ==================== ERROR MESSAGES ====================
export const ERROR_MESSAGES = {
  STRIPE_SECRET_KEY_REQUIRED: "STRIPE_SECRET_KEY environment variable is required",
  INVALID_PLAN: "Invalid subscription plan",
  USER_ALREADY_HAS_SUBSCRIPTION: "User already has an active subscription",
  USER_NOT_FOUND: "User not found",
  NO_ACTIVE_SUBSCRIPTION: "No active subscription found",
  NO_SUBSCRIPTION_TO_REACTIVATE: "No subscription found to reactivate",
  INVALID_USER_ID: "Invalid user ID format",
  USER_ALREADY_ON_PLAN: "User is already on this plan",
  INVALID_PLAN_ID: "Invalid plan ID",
  SUBSCRIPTION_NOT_FOUND: "Subscription record not found in database",
  PAYMENT_INTENT_NOT_SUCCEEDED: "Payment intent is not succeeded",
  NO_PAYMENT_INTENT_IN_INVOICE: "No payment intent found in subscription invoice",
  NO_INVOICE_IN_SUBSCRIPTION: "No invoice found in subscription",
  CANNOT_CREATE_SUBSCRIPTION_NO_USER_ID: "Cannot create subscription: userId not found in metadata or parameter",
  FAILED_TO_RETRIEVE_SUBSCRIPTION: "Failed to retrieve subscription after creation",
  CANNOT_DETERMINE_PLAN_ID: "Could not determine plan ID for subscription",
  USER_ID_NOT_FOUND_IN_METADATA: "User ID not found in subscription metadata",
  COULD_NOT_FIND_SUBSCRIPTION_ID: "Could not find subscription ID for payment intent",
} as const;

// ==================== STRIPE METADATA KEYS ====================
export const METADATA_KEYS = {
  USER_ID: "userId",
  PLAN_ID: "planId",
  PLAN_NAME: "planName",
  SUBSCRIPTION_ID: "subscriptionId",
} as const;

// ==================== BILLING STATUS ====================
export const BILLING_STATUS = {
  SUCCEEDED: "succeeded",
  FAILED: "failed",
} as const;

// ==================== CURRENCY FORMATTING ====================
export const DEFAULT_CURRENCY_LOCALE = "en-US";
export const STRIPE_AMOUNT_DIVISOR = 100; // Stripe amounts are in cents

