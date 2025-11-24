/**
 * Subscription service constants
 */

import { SubscriptionPlan } from "../types";

export const DEFAULT_BILLING_HISTORY_LIMIT = 20;
export const MAX_BILLING_HISTORY_LIMIT = 100;
export const DEFAULT_CURRENCY = "usd";
export const STRIPE_API_VERSION = "2023-10-16";

/**
 * Get all available subscription plans
 */
export function getSubscriptionPlans(): SubscriptionPlan[] {
  return [
    {
      id: "basic",
      name: "Basic Plan",
      price: 99,
      videoLimit: 1,
      stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || "",
      features: ["1 video per month", "Basic support"],
    },
    {
      id: "growth",
      name: "Growth Plan",
      price: 199,
      videoLimit: 4,
      stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID || "",
      features: ["4 videos per month", "Priority support"],
    },
    {
      id: "professional",
      name: "Professional Plan",
      price: 399,
      videoLimit: 12,
      stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || "",
      features: ["12 videos per month", "Premium support", "Advanced features"],
    },
  ];
}
