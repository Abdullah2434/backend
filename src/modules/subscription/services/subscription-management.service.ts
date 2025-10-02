import Stripe from "stripe";
import Subscription, { ISubscription } from "../../../database/models/Subscription";
import User from "../../../database/models/User";
import {
  UserSubscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
  SubscriptionConfig,
  NotFoundError,
  StripeError,
  PlanError,
} from "../types/subscription.types";
import {
  logSubscriptionEvent,
  logSubscriptionError,
  getSubscriptionConfig,
  formatDate,
  isSubscriptionActive,
  isSubscriptionCanceled,
} from "../utils/subscription.utils";

export class SubscriptionManagementService {
  private readonly config: SubscriptionConfig;
  private readonly stripe: Stripe;

  constructor() {
    this.config = getSubscriptionConfig();

    if (!this.config.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }

    this.stripe = new Stripe(this.config.stripeSecretKey, {
      apiVersion: this.config.apiVersion as any,
    });
  }

  // ==================== SUBSCRIPTION CRUD ====================

  async getCurrentSubscription(
    userId: string
  ): Promise<UserSubscription | null> {
    try {
      const subscription = await Subscription.findOne({ userId });

      if (!subscription) {
        logSubscriptionEvent("subscription_not_found", { userId });
        return null;
      }

      const userSubscription: UserSubscription = {
        id: subscription._id.toString(),
        userId: subscription.userId,
        planId: subscription.planId,
        planName: subscription.planName,
        status: subscription.status as any,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        currentPeriodStart: formatDate(subscription.currentPeriodStart),
        currentPeriodEnd: formatDate(subscription.currentPeriodEnd),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt
          ? formatDate(subscription.canceledAt)
          : undefined,
        trialStart: subscription.trialStart
          ? formatDate(subscription.trialStart)
          : undefined,
        trialEnd: subscription.trialEnd
          ? formatDate(subscription.trialEnd)
          : undefined,
        videoCount: subscription.videoCount,
        videoLimit: subscription.videoLimit,
        createdAt: formatDate(subscription.createdAt),
        updatedAt: formatDate(subscription.updatedAt),
      };

      logSubscriptionEvent("subscription_retrieved", {
        userId,
        subscriptionId: subscription._id.toString(),
        status: subscription.status,
      });

      return userSubscription;
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId,
        action: "getCurrentSubscription",
      });
      throw new StripeError("Failed to retrieve subscription");
    }
  }

  async createSubscription(
    data: CreateSubscriptionData
  ): Promise<UserSubscription> {
    try {
      const user = await User.findById(data.userId);
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Get or create Stripe customer
      const customerId = await this.getOrCreateCustomer(
        data.userId,
        user.email
      );

      // Create Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: data.planId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        trial_period_days: data.trialDays || this.config.trialDays,
        metadata: {
          userId: data.userId,
        },
      });

      // Create local subscription record
      const subscription = new Subscription({
        userId: data.userId,
        planId: data.planId,
        planName: this.getPlanName(data.planId),
        status: stripeSubscription.status,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customerId,
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : undefined,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : undefined,
        videoCount: 0,
        videoLimit: this.getVideoLimit(data.planId),
      });

      await subscription.save();

      const userSubscription: UserSubscription = {
        id: subscription._id.toString(),
        userId: subscription.userId,
        planId: subscription.planId,
        planName: subscription.planName,
        status: subscription.status as any,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        currentPeriodStart: formatDate(subscription.currentPeriodStart),
        currentPeriodEnd: formatDate(subscription.currentPeriodEnd),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialStart: subscription.trialStart
          ? formatDate(subscription.trialStart)
          : undefined,
        trialEnd: subscription.trialEnd
          ? formatDate(subscription.trialEnd)
          : undefined,
        videoCount: subscription.videoCount,
        videoLimit: subscription.videoLimit,
        createdAt: formatDate(subscription.createdAt),
        updatedAt: formatDate(subscription.updatedAt),
      };

      logSubscriptionEvent("subscription_created", {
        userId: data.userId,
        subscriptionId: subscription._id.toString(),
        planId: data.planId,
      });

      return userSubscription;
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId: data.userId,
        planId: data.planId,
        action: "createSubscription",
      });
      throw new StripeError("Failed to create subscription");
    }
  }

  async cancelSubscription(
    userId: string,
    reason?: string,
    immediate: boolean = false
  ): Promise<UserSubscription> {
    try {
      const subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      if (!subscription.stripeSubscriptionId) {
        throw new StripeError("Stripe subscription ID not found");
      }

      // Cancel Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: !immediate,
          metadata: {
            cancellation_reason: reason || "User requested cancellation",
          },
        }
      );

      // Update local subscription
      subscription.status = immediate ? "canceled" : "active";
      subscription.cancelAtPeriodEnd = !immediate;
      subscription.canceledAt = immediate ? new Date() : undefined;
      await subscription.save();

      const userSubscription: UserSubscription = {
        id: subscription._id.toString(),
        userId: subscription.userId,
        planId: subscription.planId,
        planName: subscription.planName,
        status: subscription.status as any,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        currentPeriodStart: formatDate(subscription.currentPeriodStart),
        currentPeriodEnd: formatDate(subscription.currentPeriodEnd),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt
          ? formatDate(subscription.canceledAt)
          : undefined,
        trialStart: subscription.trialStart
          ? formatDate(subscription.trialStart)
          : undefined,
        trialEnd: subscription.trialEnd
          ? formatDate(subscription.trialEnd)
          : undefined,
        videoCount: subscription.videoCount,
        videoLimit: subscription.videoLimit,
        createdAt: formatDate(subscription.createdAt),
        updatedAt: formatDate(subscription.updatedAt),
      };

      logSubscriptionEvent("subscription_canceled", {
        userId,
        subscriptionId: subscription._id.toString(),
        immediate,
        reason,
      });

      return userSubscription;
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId,
        action: "cancelSubscription",
      });
      throw new StripeError("Failed to cancel subscription");
    }
  }

  async reactivateSubscription(userId: string): Promise<UserSubscription> {
    try {
      const subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      if (!subscription.stripeSubscriptionId) {
        throw new StripeError("Stripe subscription ID not found");
      }

      // Reactivate Stripe subscription
      await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: false,
          metadata: {
            reactivated_at: new Date().toISOString(),
          },
        }
      );

      // Update local subscription
      subscription.status = "active";
      subscription.cancelAtPeriodEnd = false;
      subscription.canceledAt = undefined;
      await subscription.save();

      const userSubscription: UserSubscription = {
        id: subscription._id.toString(),
        userId: subscription.userId,
        planId: subscription.planId,
        planName: subscription.planName,
        status: subscription.status as any,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        currentPeriodStart: formatDate(subscription.currentPeriodStart),
        currentPeriodEnd: formatDate(subscription.currentPeriodEnd),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt
          ? formatDate(subscription.canceledAt)
          : undefined,
        trialStart: subscription.trialStart
          ? formatDate(subscription.trialStart)
          : undefined,
        trialEnd: subscription.trialEnd
          ? formatDate(subscription.trialEnd)
          : undefined,
        videoCount: subscription.videoCount,
        videoLimit: subscription.videoLimit,
        createdAt: formatDate(subscription.createdAt),
        updatedAt: formatDate(subscription.updatedAt),
      };

      logSubscriptionEvent("subscription_reactivated", {
        userId,
        subscriptionId: subscription._id.toString(),
      });

      return userSubscription;
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId,
        action: "reactivateSubscription",
      });
      throw new StripeError("Failed to reactivate subscription");
    }
  }

  async changePlan(
    userId: string,
    newPlanId: string,
    prorationBehavior:
      | "create_prorations"
      | "none"
      | "always_invoice" = "create_prorations"
  ): Promise<UserSubscription> {
    try {
      const subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      if (!subscription.stripeSubscriptionId) {
        throw new StripeError("Stripe subscription ID not found");
      }

      // Update Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          items: [{ price: newPlanId }],
          proration_behavior: prorationBehavior,
          metadata: {
            plan_changed_at: new Date().toISOString(),
            previous_plan: subscription.planId,
          },
        }
      );

      // Update local subscription
      subscription.planId = newPlanId;
      subscription.planName = this.getPlanName(newPlanId);
      subscription.videoLimit = this.getVideoLimit(newPlanId);
      subscription.currentPeriodStart = new Date(
        stripeSubscription.current_period_start * 1000
      );
      subscription.currentPeriodEnd = new Date(
        stripeSubscription.current_period_end * 1000
      );
      await subscription.save();

      const userSubscription: UserSubscription = {
        id: subscription._id.toString(),
        userId: subscription.userId,
        planId: subscription.planId,
        planName: subscription.planName,
        status: subscription.status as any,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        currentPeriodStart: formatDate(subscription.currentPeriodStart),
        currentPeriodEnd: formatDate(subscription.currentPeriodEnd),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt
          ? formatDate(subscription.canceledAt)
          : undefined,
        trialStart: subscription.trialStart
          ? formatDate(subscription.trialStart)
          : undefined,
        trialEnd: subscription.trialEnd
          ? formatDate(subscription.trialEnd)
          : undefined,
        videoCount: subscription.videoCount,
        videoLimit: subscription.videoLimit,
        createdAt: formatDate(subscription.createdAt),
        updatedAt: formatDate(subscription.updatedAt),
      };

      logSubscriptionEvent("subscription_plan_changed", {
        userId,
        subscriptionId: subscription._id.toString(),
        oldPlanId: subscription.planId,
        newPlanId,
      });

      return userSubscription;
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId,
        newPlanId,
        action: "changePlan",
      });
      throw new StripeError("Failed to change subscription plan");
    }
  }

  // ==================== UTILITY METHODS ====================

  private async getOrCreateCustomer(
    userId: string,
    email: string
  ): Promise<string> {
    try {
      // Check if customer already exists
      const existingCustomers = await this.stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0].id;
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email: email,
        metadata: {
          userId: userId,
        },
      });

      return customer.id;
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId,
        email,
        action: "getOrCreateCustomer",
      });
      throw new StripeError("Failed to get or create customer");
    }
  }

  private getPlanName(planId: string): string {
    const plan = this.config.plans.find((p) => p.id === planId);
    return plan ? plan.name : "Unknown Plan";
  }

  private getVideoLimit(planId: string): number {
    const plan = this.config.plans.find((p) => p.id === planId);
    return plan ? plan.videoLimit : 0;
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      stripe: "available" | "unavailable";
      database: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      // Test Stripe connection
      await this.stripe.customers.list({ limit: 1 });

      // Test database connection
      await Subscription.findOne().limit(1);

      return {
        status: "healthy",
        services: {
          stripe: "available",
          database: "available",
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          stripe: "unavailable",
          database: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default SubscriptionManagementService;
