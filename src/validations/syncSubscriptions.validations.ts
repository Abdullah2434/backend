import { z } from "zod";

/**
 * Validation schema for subscription status
 */
export const subscriptionStatusSchema = z.enum([
  "active",
  "canceled",
  "past_due",
  "unpaid",
  "pending",
  "incomplete",
]);

/**
 * Validation schema for active subscription status (for sync)
 */
export const activeSubscriptionStatusSchema = z.enum([
  "active",
  "pending",
  "incomplete",
  "past_due",
]);

/**
 * Valid subscription statuses
 */
export const VALID_SUBSCRIPTION_STATUSES = [
  "active",
  "canceled",
  "past_due",
  "unpaid",
  "pending",
  "incomplete",
] as const;

/**
 * Valid subscription statuses for sync
 */
export const VALID_SYNC_SUBSCRIPTION_STATUSES = [
  "active",
  "pending",
  "incomplete",
  "past_due",
] as const;

