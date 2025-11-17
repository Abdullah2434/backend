/**
 * Helper functions for subscription service
 */

import Stripe from "stripe";
import mongoose from "mongoose";
import Subscription, { ISubscription } from "../models/Subscription";
import Billing from "../models/Billing";
import { UserSubscription, SubscriptionPlan } from "../types";
import {
  INVOICE_STATUS_TO_BILLING_STATUS,
  DEFAULT_BILLING_PERIOD_DAYS,
} from "../constants/subscription.constants";

// ==================== STRIPE CUSTOMER UTILITIES ====================
/**
 * Find Stripe customer by email
 */
export async function findStripeCustomer(
  stripe: Stripe,
  email: string
): Promise<Stripe.Customer | null> {
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });
  return customers.data[0] || null;
}

/**
 * Create Stripe customer
 */
export async function createStripeCustomer(
  stripe: Stripe,
  email: string,
  name: string,
  paymentMethodId?: string
): Promise<Stripe.Customer> {
  const customerData: Stripe.CustomerCreateParams = {
    email,
    name,
  };

  if (paymentMethodId) {
    customerData.payment_method = paymentMethodId;
    customerData.invoice_settings = {
      default_payment_method: paymentMethodId,
    };
  }

  return await stripe.customers.create(customerData);
}

// ==================== SUBSCRIPTION FORMATTING ====================
/**
 * Format subscription for API response
 */
export function formatSubscription(
  subscription: ISubscription
): UserSubscription {
  return {
    id: subscription._id.toString(),
    userId: subscription.userId.toString(),
    planId: subscription.planId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripeCustomerId: subscription.stripeCustomerId,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    videoCount: subscription.videoCount,
    videoLimit: subscription.videoLimit,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

/**
 * Build subscription object from Stripe subscription
 */
export function buildSubscriptionFromStripe(
  stripeSubscription: Stripe.Subscription,
  userId: string,
  planId: string,
  plan: SubscriptionPlan,
  customerId: string
): Partial<UserSubscription> {
  return {
    id: stripeSubscription.id,
    userId,
    planId,
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId: customerId,
    status: (stripeSubscription.status === "active"
      ? "active"
      : "pending") as UserSubscription["status"],
    currentPeriodStart: new Date(
      stripeSubscription.current_period_start * 1000
    ),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    videoLimit: plan.videoLimit,
    videoCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ==================== PAYMENT INTENT UTILITIES ====================
/**
 * Get subscription ID from payment intent metadata
 */
export function getSubscriptionIdFromPaymentIntentMetadata(
  paymentIntent: Stripe.PaymentIntent
): string | null {
  return paymentIntent.metadata?.subscriptionId || null;
}

/**
 * Get subscription ID from payment intent
 * Tries multiple methods to find the subscription ID
 */
export async function getSubscriptionIdFromPaymentIntent(
  stripe: Stripe,
  paymentIntentId: string
): Promise<string | null> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId
    );

    // Method 1: Check metadata for subscription ID
    if (paymentIntent.metadata?.subscriptionId) {
      return paymentIntent.metadata.subscriptionId;
    }

    // Method 2: Check invoice (payment intent might be linked to invoice)
    if (paymentIntent.invoice) {
      const invoiceId =
        typeof paymentIntent.invoice === "string"
          ? paymentIntent.invoice
          : paymentIntent.invoice.id;

      const invoice = await stripe.invoices.retrieve(invoiceId);
      if (invoice.subscription) {
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

        return subscriptionId;
      }
    }

    // Method 3: Search invoices by customer
    let customerId: string | undefined;
    if (paymentIntent.customer) {
      customerId =
        typeof paymentIntent.customer === "string"
          ? paymentIntent.customer
          : paymentIntent.customer.id;
    }

    const searchParams: any = {
      limit: 100, // Search more invoices
    };

    if (customerId) {
      searchParams.customer = customerId;
    }

    const invoices = await stripe.invoices.list(searchParams);

    for (const invoice of invoices.data) {
      if (
        invoice.payment_intent &&
        (typeof invoice.payment_intent === "string"
          ? invoice.payment_intent === paymentIntentId
          : invoice.payment_intent.id === paymentIntentId)
      ) {
        if (invoice.subscription) {
          const subscriptionId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription.id;

          return subscriptionId;
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Update payment intent metadata with subscription info
 */
export async function updatePaymentIntentMetadata(
  stripe: Stripe,
  paymentIntentId: string,
  metadata: {
    subscriptionId: string;
    userId: string;
    planId: string;
    planName: string;
  }
): Promise<void> {
  await stripe.paymentIntents.update(paymentIntentId, {
    metadata,
  });
}

/**
 * Extract payment intent from invoice
 */
export async function getPaymentIntentFromInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice | string
): Promise<Stripe.PaymentIntent | null> {
  const invoiceObj =
    typeof invoice === "string"
      ? await stripe.invoices.retrieve(invoice)
      : invoice;

  if (!invoiceObj.payment_intent) {
    return null;
  }

  const paymentIntentId =
    typeof invoiceObj.payment_intent === "string"
      ? invoiceObj.payment_intent
      : invoiceObj.payment_intent.id;

  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

// ==================== SUBSCRIPTION STATUS UTILITIES ====================
/**
 * Check if subscription status is active
 */
export function isActiveStatus(
  status: string
): status is "active" | "pending" {
  return status === "active" || status === "pending";
}

/**
 * Check if subscription is past due
 */
export function isPastDue(subscription: ISubscription): boolean {
  if (subscription.status !== "pending") {
    return false;
  }

  const now = new Date();
  return now > subscription.currentPeriodEnd;
}

/**
 * Check if subscription can be used (active and not past due)
 */
export function canUseSubscription(
  subscription: ISubscription | null
): boolean {
  if (!subscription) {
    return false;
  }

  if (!isActiveStatus(subscription.status)) {
    return false;
  }

  return !isPastDue(subscription);
}

// ==================== BILLING RECORD UTILITIES ====================
/**
 * Map invoice status to billing status
 */
export function mapInvoiceStatusToBillingStatus(
  invoiceStatus: string
): string {
  return (
    INVOICE_STATUS_TO_BILLING_STATUS[invoiceStatus] ||
    "pending"
  );
}

/**
 * Build billing description
 */
export function buildBillingDescription(
  planName?: string,
  subscriptionId?: string
): string {
  if (planName) {
    return `Subscription payment for ${planName}`;
  }

  return "Subscription payment";
}

/**
 * Create billing record from Stripe invoice
 */
export async function createBillingRecord(
  userId: string,
  invoice: Stripe.Invoice,
  subscriptionId: string,
  planName?: string
): Promise<void> {
  // Check if billing record already exists
  const existingBilling = await Billing.findOne({
    stripeInvoiceId: invoice.id,
  });

  if (existingBilling) {
    // Update existing billing record with subscription ID if missing
    if (!existingBilling.subscriptionId) {
      existingBilling.subscriptionId = subscriptionId as any;
      await existingBilling.save();
    }
    return;
  }

  const description = buildBillingDescription(planName, subscriptionId);
  const billingStatus = mapInvoiceStatusToBillingStatus(
    invoice.status || "draft"
  );

  const billing = new Billing({
    userId,
    amount: invoice.amount_due || invoice.amount_paid || 0,
    currency: invoice.currency || "usd",
    status: billingStatus,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId:
      typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent?.id || null,
    description,
    subscriptionId,
  });

  await billing.save();
}

/**
 * Sync billing records for a subscription
 */
export async function syncBillingRecordsForSubscription(
  stripe: Stripe,
  localSubscription: ISubscription,
  stripeSubscription: Stripe.Subscription,
  getPlanName: (planId: string) => string | undefined
): Promise<{ created: number; updated: number }> {
  try {
    const invoices = await stripe.invoices.list({
      subscription: stripeSubscription.id,
      limit: 100, // Get up to 100 invoices
    });

    let createdCount = 0;
    let updatedCount = 0;

    // Process each invoice
    for (const invoice of invoices.data) {
      if (!invoice.id) continue;

      // Check if billing record already exists
      const existingBilling = await Billing.findOne({
        stripeInvoiceId: invoice.id,
      });

      if (!existingBilling) {
        // Create new billing record
        const planName =
          getPlanName(localSubscription.planId) ||
          stripeSubscription.metadata?.planName ||
          "Subscription";
        await createBillingRecord(
          localSubscription.userId.toString(),
          invoice,
          localSubscription._id.toString(),
          planName
        );
        createdCount++;
      } else if (!existingBilling.subscriptionId) {
        // Update existing billing record with subscription ID if missing
        existingBilling.subscriptionId = localSubscription._id;
        await existingBilling.save();
        updatedCount++;
      }
    }

    return { created: createdCount, updated: updatedCount };
  } catch (error: any) {
    // Don't throw - this is a non-critical operation
    return { created: 0, updated: 0 };
  }
}

// ==================== SUBSCRIPTION CLEANUP ====================
/**
 * Clean up incomplete subscriptions
 */
export async function cleanupIncompleteSubscriptions(
  stripe: Stripe,
  userId: string
): Promise<{ deleted: number; errors: number }> {
  try {
    // Find incomplete subscriptions in database
    const incompleteSubscriptions = await Subscription.find({
      userId,
      status: { $in: ["pending", "incomplete", "past_due"] },
    });

    let deletedCount = 0;
    let errorCount = 0;

    for (const subscription of incompleteSubscriptions) {
      try {
        // Cancel the subscription in Stripe
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

        // Delete from database
        await Subscription.deleteOne({ _id: subscription._id });
        deletedCount++;
      } catch (stripeError) {
        // Still delete from database even if Stripe cancellation fails
        await Subscription.deleteOne({ _id: subscription._id });
        deletedCount++;
      }
    }

    return { deleted: deletedCount, errors: errorCount };
  } catch (error) {
    return { deleted: 0, errors: 1 };
  }
}

// ==================== SUBSCRIPTION QUERY UTILITIES ====================
/**
 * Build subscription query for active subscriptions
 */
export function buildActiveSubscriptionQuery(userId: string) {
  return {
    userId,
    status: { $in: ["active", "pending"] },
  };
}

/**
 * Build subscription query for existing subscriptions
 */
export function buildExistingSubscriptionQuery(userId: string) {
  return {
    userId,
    status: { $in: ["active", "pending", "incomplete", "past_due"] },
  };
}

/**
 * Build subscription query for plan-specific subscriptions
 */
export function buildPlanSubscriptionQuery(userId: string, planId: string) {
  return {
    userId,
    planId,
    status: { $in: ["active", "pending", "incomplete", "past_due"] },
  };
}

// ==================== VALIDATION ====================
/**
 * Validate user ID format
 */
export function validateUserId(userId: string): void {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID format");
  }
}

/**
 * Validate plan exists
 */
export function validatePlan(
  plan: SubscriptionPlan | undefined
): asserts plan is SubscriptionPlan {
  if (!plan) {
    throw new Error("Invalid subscription plan");
  }
}

// ==================== DATE UTILITIES ====================
/**
 * Calculate next billing period end date
 */
export function calculateNextBillingPeriodEnd(
  startDate: Date = new Date(),
  days: number = DEFAULT_BILLING_PERIOD_DAYS
): Date {
  return new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Convert Stripe timestamp to Date
 */
export function stripeTimestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

// ==================== PLAN UTILITIES ====================
/**
 * Find plan by Stripe price ID
 */
export function findPlanByPriceId(
  plans: SubscriptionPlan[],
  priceId: string
): SubscriptionPlan | undefined {
  return plans.find((plan) => plan.stripePriceId === priceId);
}

/**
 * Get plan change options (upgrades/downgrades)
 */
export function getPlanChangeOptions(
  plans: SubscriptionPlan[],
  currentPlanId: string
): {
  upgrades: SubscriptionPlan[];
  downgrades: SubscriptionPlan[];
  currentPlan: SubscriptionPlan;
} {
  const currentPlan = plans.find((plan) => plan.id === currentPlanId);
  if (!currentPlan) {
    throw new Error("Current plan not found");
  }

  const upgrades = plans.filter((plan) => plan.price > currentPlan.price);
  const downgrades = plans.filter((plan) => plan.price < currentPlan.price);

  return {
    upgrades,
    downgrades,
    currentPlan,
  };
}

