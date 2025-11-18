/**
 * Constants for subscription service
 */

import { SubscriptionPlan } from "../types";

// Stripe API version
export const STRIPE_API_VERSION = "2023-10-16";

// Default monthly plan price (in cents)
export const DEFAULT_MONTHLY_PRICE = 99700; // $997.00

// Default video limit for monthly plan
export const DEFAULT_MONTHLY_VIDEO_LIMIT = 30;

// Default billing period in days
export const DEFAULT_BILLING_PERIOD_DAYS = 30;

/**
 * Get subscription plans configuration
 */
export function getSubscriptionPlans(): SubscriptionPlan[] {
  return [
    {
      id: "monthly",
      name: "Monthly Plan",
      price: parseInt(
        process.env.STRIPE_MONTHLY_PRICE || String(DEFAULT_MONTHLY_PRICE),
        10
      ), // $997.00 in cents, configurable via env
      videoLimit: DEFAULT_MONTHLY_VIDEO_LIMIT,
      stripePriceId:
        process.env.STRIPE_MONTHLY_PRICE_ID ||
        process.env.STRIPE_PRICE_ID ||
        "price_monthly",
      features: [
        "30 videos per month",
        "Unlimited photo avatars",
        "Unlimited video avatars",
        "Unlimited custom voices",
        "Monthly renewal",
      ],
    },
  ];
}

// Subscription status constants
export const VALID_SUBSCRIPTION_STATUSES = [
  "active",
  "canceled",
  "past_due",
  "unpaid",
  "pending",
  "incomplete",
] as const;

export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "pending"] as const;

export const INCOMPLETE_SUBSCRIPTION_STATUSES = [
  "pending",
  "incomplete",
  "past_due",
] as const;

// Billing status mappings
export const INVOICE_STATUS_TO_BILLING_STATUS: Record<string, string> = {
  paid: "succeeded",
  open: "open",
  void: "failed",
  uncollectible: "failed",
  draft: "pending",
};

