import { Request } from "express";
import Stripe from "stripe";
import AuthService from "../services/auth.service";
import Subscription, { ISubscription } from "../models/Subscription";
import Billing from "../models/Billing";
import { DEFAULT_BILLING_HISTORY_LIMIT } from "../constants/subscription.constants";
import { SubscriptionPlan, UserSubscription } from "../types";

// ==================== SERVICE INSTANCES ====================
const authService = new AuthService();

// ==================== CONTROLLER HELPER FUNCTIONS ====================

/**
 * Require authentication from request
 */
export function requireAuth(req: Request) {
  const token = extractToken(req);
  if (!token) throw new Error("Access token is required");
  const payload = authService.verifyToken(token);
  if (!payload) throw new Error("Invalid or expired access token");
  return payload;
}

/**
 * Extract token from request headers
 */
export function extractToken(req: Request): string {
  return (req.headers.authorization || "").replace("Bearer ", "");
}

/**
 * Determine HTTP status code based on error message
 */
export function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("access token") ||
    message.includes("token") ||
    message.includes("not authenticated") ||
    message.includes("unauthorized")
  ) {
    return 401;
  }
  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

/**
 * Prepare billing history options from query parameters
 */
export function prepareBillingHistoryOptions(data: {
  limit?: number;
  offset?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}): any {
  const options: any = {
    limit: data.limit || DEFAULT_BILLING_HISTORY_LIMIT,
    offset: data.offset || 0,
  };

  if (data.status) options.status = data.status;
  if (data.startDate) options.startDate = new Date(data.startDate);
  if (data.endDate) options.endDate = new Date(data.endDate);

  return options;
}

/**
 * Get identifier for sync subscription (paymentIntentId or stripeSubscriptionId)
 */
export function getSyncIdentifier(
  paymentIntentId?: string,
  stripeSubscriptionId?: string
): string {
  return paymentIntentId || stripeSubscriptionId || "";
}

// ==================== SERVICE-LEVEL UTILITY FUNCTIONS ====================

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
 * Format subscription document to UserSubscription type
 */
export function formatSubscription(
  subscription: ISubscription
): UserSubscription {
  return {
    id: subscription._id.toString(),
    userId: subscription.userId.toString(),
    planId: subscription.planId,
    status: subscription.status,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripeCustomerId: subscription.stripeCustomerId,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    videoLimit: subscription.videoLimit,
    videoCount: subscription.videoCount,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

/**
 * Get subscription ID from payment intent
 */
export async function getSubscriptionIdFromPaymentIntent(
  stripe: Stripe,
  paymentIntentId: string
): Promise<string | null> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const subscriptionId = paymentIntent.metadata?.subscriptionId;
    return subscriptionId || null;
  } catch (error) {
    console.error("Error retrieving payment intent:", error);
    return null;
  }
}

/**
 * Sync billing records for a subscription
 */
export async function syncBillingRecordsForSubscription(
  stripe: Stripe,
  localSubscription: ISubscription,
  stripeSubscription: Stripe.Subscription,
  getPlanName: (planId: string) => string | undefined
): Promise<void> {
  try {
    // Get all invoices for this subscription
    const invoices = await stripe.invoices.list({
      subscription: stripeSubscription.id,
      limit: 100,
    });

    // Create or update billing records for each invoice
    for (const invoice of invoices.data) {
      if (invoice.payment_intent && typeof invoice.payment_intent === "string") {
        const existingBilling = await Billing.findOne({
          stripePaymentIntentId: invoice.payment_intent,
        });

        if (!existingBilling) {
          await createBillingRecord(
            stripe,
            invoice,
            localSubscription.userId.toString(),
            getPlanName(localSubscription.planId)
          );
        } else {
          // Update existing billing record with subscription ID
          existingBilling.subscriptionId = localSubscription._id;
          await existingBilling.save();
        }
      }
    }
  } catch (error) {
    console.error("Error syncing billing records:", error);
  }
}

/**
 * Cleanup incomplete subscriptions
 */
export async function cleanupIncompleteSubscriptions(
  stripe: Stripe,
  userId: string
): Promise<void> {
  try {
    await Subscription.deleteMany({
      userId,
      status: { $in: ["incomplete", "incomplete_expired"] },
    });
  } catch (error) {
    console.error("Error cleaning up incomplete subscriptions:", error);
  }
}

/**
 * Update payment intent metadata
 */
export async function updatePaymentIntentMetadata(
  stripe: Stripe,
  paymentIntentId: string,
  metadata: { [key: string]: string }
): Promise<void> {
  await stripe.paymentIntents.update(paymentIntentId, {
    metadata,
  });
}

/**
 * Create Stripe customer
 */
export async function createStripeCustomer(
  stripe: Stripe,
  email: string,
  name?: string
): Promise<Stripe.Customer> {
  return await stripe.customers.create({
    email,
    name,
  });
}

/**
 * Check if subscription is past due
 */
export function isPastDue(status: string): boolean {
  return status === "past_due" || status === "unpaid";
}

/**
 * Convert Stripe timestamp to Date
 */
export function stripeTimestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

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
    throw new Error(`Plan with ID ${currentPlanId} not found`);
  }
  
  const currentPrice = currentPlan.price;

  const upgrades = plans.filter((plan) => plan.price > currentPrice);
  const downgrades = plans.filter((plan) => plan.price < currentPrice);

  return {
    upgrades,
    downgrades,
    currentPlan,
  };
}

/**
 * Create billing record from invoice
 */
export async function createBillingRecord(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  userId: string,
  planName?: string
): Promise<void> {
  try {
    const paymentIntentId =
      typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent?.id;

    if (!paymentIntentId) {
      return;
    }

    const billingRecord = new Billing({
      userId,
      stripePaymentIntentId: paymentIntentId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid || 0,
      currency: invoice.currency || "usd",
      status: invoice.status === "paid" ? "succeeded" : "pending",
      planName: planName || "Unknown",
      createdAt: new Date(invoice.created * 1000),
    });

    await billingRecord.save();
  } catch (error) {
    console.error("Error creating billing record:", error);
  }
}
