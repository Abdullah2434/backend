/**
 * Helper functions specific to subscription service operations
 */

import Stripe from "stripe";
import mongoose from "mongoose";
import Subscription, { ISubscription } from "../models/Subscription";
import Billing from "../models/Billing";
import { UserSubscription, SubscriptionPlan } from "../types";
import {
  ACTIVE_OR_PENDING_STATUSES,
  INCOMPLETE_STATUSES,
  ALL_SUBSCRIPTION_STATUSES,
  PAYMENT_INTENT_PREFIX,
  DEFAULT_BILLING_PERIOD_DAYS,
  STRIPE_AMOUNT_DIVISOR,
  DEFAULT_CURRENCY_LOCALE,
} from "../constants/subscriptionService.constants";
import { stripeTimestampToDate, formatSubscription } from "./subscriptionHelpers";

// ==================== SUBSCRIPTION QUERY HELPERS ====================
/**
 * Build subscription query for active or pending statuses
 */
export function buildActiveOrPendingQuery(userId: string) {
  return {
    userId,
    status: { $in: ACTIVE_OR_PENDING_STATUSES },
  };
}

/**
 * Build subscription query for all subscription statuses
 */
export function buildAllStatusesQuery(userId: string, planId?: string) {
  const query: any = {
    userId,
    status: { $in: ALL_SUBSCRIPTION_STATUSES },
  };
  if (planId) {
    query.planId = planId;
  }
  return query;
}

/**
 * Build subscription query for incomplete statuses
 */
export function buildIncompleteQuery(userId: string) {
  return {
    userId,
    status: { $in: INCOMPLETE_STATUSES },
  };
}

// ==================== SUBSCRIPTION VALIDATION HELPERS ====================
/**
 * Check if payment intent ID
 */
export function isPaymentIntentId(id: string): boolean {
  return id.startsWith(PAYMENT_INTENT_PREFIX);
}

/**
 * Validate user ID format
 */
export function validateUserId(userId: string): void {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID format");
  }
}

// ==================== SUBSCRIPTION CREATION HELPERS ====================
/**
 * Build subscription metadata for Stripe
 */
export function buildSubscriptionMetadata(
  userId: string,
  planId: string,
  planName: string
): Record<string, string> {
  return {
    userId,
    planId,
    planName,
  };
}

/**
 * Build payment intent metadata for Stripe
 */
export function buildPaymentIntentMetadata(
  subscriptionId: string,
  userId: string,
  planId: string,
  planName: string
): {
  subscriptionId: string;
  userId: string;
  planId: string;
  planName: string;
} {
  return {
    subscriptionId,
    userId,
    planId,
    planName,
  };
}

/**
 * Build subscription creation params for Stripe
 */
export function buildStripeSubscriptionParams(
  customerId: string,
  priceId: string,
  metadata: Record<string, string>,
  description: string
): Stripe.SubscriptionCreateParams {
  return {
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
    metadata,
    description,
  };
}

/**
 * Extract payment intent from subscription invoice
 */
export async function extractPaymentIntentFromSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<Stripe.PaymentIntent> {
  if (!subscription.latest_invoice) {
    throw new Error("No invoice found in subscription");
  }

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  if (!invoice.payment_intent) {
    throw new Error("No payment intent found in subscription invoice");
  }

  return typeof invoice.payment_intent === "string"
    ? await stripe.paymentIntents.retrieve(invoice.payment_intent)
    : invoice.payment_intent;
}

/**
 * Build temporary subscription object for API response
 */
export function buildTemporarySubscription(
  subscription: Stripe.Subscription,
  userId: string,
  planId: string,
  customerId: string,
  plan: SubscriptionPlan
): UserSubscription {
  return {
    id: subscription.id,
    userId,
    planId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    status: "pending", // Will be updated via webhook
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    videoLimit: plan.videoLimit,
    videoCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserSubscription;
}

// ==================== SUBSCRIPTION UPDATE HELPERS ====================
/**
 * Update subscription period dates from Stripe
 */
export async function updateSubscriptionPeriodDates(
  stripe: Stripe,
  subscription: ISubscription,
  stripeSubscriptionId: string
): Promise<void> {
  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(
      stripeSubscriptionId
    );

    subscription.currentPeriodStart = new Date(
      stripeSubscription.current_period_start * 1000
    );
    subscription.currentPeriodEnd = new Date(
      stripeSubscription.current_period_end * 1000
    );
  } catch (error) {
    // Silently fail - period dates will be updated on next sync
  }
}

/**
 * Update subscription from Stripe data
 */
export function updateSubscriptionFromStripe(
  subscription: ISubscription,
  stripeSubscription: Stripe.Subscription
): void {
  subscription.status = stripeSubscription.status as any;
  subscription.currentPeriodStart = stripeTimestampToDate(
    stripeSubscription.current_period_start
  );
  subscription.currentPeriodEnd = stripeTimestampToDate(
    stripeSubscription.current_period_end
  );
  subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
}

// ==================== BILLING HELPERS ====================
/**
 * Format transaction amount for display
 */
export function formatTransactionAmount(
  amount: number,
  currency: string
): string {
  return new Intl.NumberFormat(DEFAULT_CURRENCY_LOCALE, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / STRIPE_AMOUNT_DIVISOR);
}

/**
 * Build billing history query
 */
export function buildBillingHistoryQuery(
  userId: string,
  options: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }
): any {
  const query: any = { userId };

  if (options.status) {
    query.status = options.status;
  }

  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) query.createdAt.$gte = options.startDate;
    if (options.endDate) query.createdAt.$lte = options.endDate;
  }

  return query;
}

/**
 * Format billing transaction for API response
 */
export function formatBillingTransaction(transaction: any): any {
  return {
    id: (transaction._id as mongoose.Types.ObjectId).toString(),
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
    description: transaction.description,
    stripeInvoiceId: transaction.stripeInvoiceId,
    stripePaymentIntentId: transaction.stripePaymentIntentId,
    subscriptionId: transaction.subscriptionId?._id?.toString(),
    planId: transaction.subscriptionId?.planId,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    formattedAmount: formatTransactionAmount(
      transaction.amount,
      transaction.currency
    ),
  };
}

// ==================== VIDEO COUNT HELPERS ====================
/**
 * Calculate remaining video count
 */
export function calculateRemainingVideos(
  videoLimit: number,
  videoCount: number
): number {
  return Math.max(0, videoLimit - videoCount);
}

/**
 * Reset video count for new period
 */
export function resetVideoCountDates(): {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
} {
  const now = new Date();
  return {
    currentPeriodStart: now,
    currentPeriodEnd: new Date(
      now.getTime() + DEFAULT_BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000
    ),
  };
}

