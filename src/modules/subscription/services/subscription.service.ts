import mongoose from "mongoose";
import Subscription from "../../../models/Subscription";
import User from "../../../models/User";
import { stripeService } from "./stripe.service";
import { logger } from "../../../core/utils/logger";
import { NotFoundError, ConflictError } from "../../../core/errors";
import {
  SubscriptionPlan,
  UserSubscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
  SubscriptionUsage,
} from "../types/subscription.types";

export class SubscriptionService {
  private plans: SubscriptionPlan[];

  constructor() {
    // Define subscription plans
    this.plans = [
      {
        id: "basic",
        name: "Basic Plan",
        price: 9900, // $99.00 in cents
        videoLimit: 1,
        stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || "price_basic",
        features: ["1 video per month", "Basic support", "Standard processing"],
      },
      {
        id: "growth",
        name: "Growth Plan",
        price: 19900, // $199.00 in cents
        videoLimit: 4,
        stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID || "price_growth",
        features: [
          "4 videos per month",
          "Priority support",
          "Faster processing",
        ],
      },
      {
        id: "professional",
        name: "Professional Plan",
        price: 39900, // $399.00 in cents
        videoLimit: 12,
        stripePriceId:
          process.env.STRIPE_PROFESSIONAL_PRICE_ID || "price_professional",
        features: [
          "12 videos per month",
          "Premium support",
          "Fastest processing",
          "Priority queue",
        ],
      },
    ];
  }

  /**
   * Get all available subscription plans
   */
  getPlans(): SubscriptionPlan[] {
    return this.plans;
  }

  /**
   * Get a specific plan by ID
   */
  getPlan(planId: string): SubscriptionPlan | undefined {
    return this.plans.find((plan) => plan.id === planId);
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    data: CreateSubscriptionData
  ): Promise<UserSubscription> {
    const { userId, planId, paymentMethodId } = data;

    // Get the plan
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new NotFoundError("Invalid subscription plan");
    }

    // Check if user already has an active subscription
    const existingSubscription = await this.getActiveSubscription(userId);
    if (existingSubscription) {
      throw new ConflictError("User already has an active subscription");
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    try {
      // Create or get Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripeService.createCustomer(user.email, {
          userId: user._id.toString(),
        });
        stripeCustomerId = customer.id;
        user.stripeCustomerId = stripeCustomerId;
        await user.save();
      }

      // Attach payment method to customer
      await stripeService.attachPaymentMethod(
        paymentMethodId,
        stripeCustomerId
      );
      await stripeService.setDefaultPaymentMethod(
        stripeCustomerId,
        paymentMethodId
      );

      // Create Stripe subscription
      const stripeSubscription = await stripeService.createSubscription(
        stripeCustomerId,
        plan.stripePriceId,
        {
          userId: user._id.toString(),
          planId: plan.id,
        }
      );

      // Create subscription in database
      const subscription = new Subscription({
        userId: user._id,
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId,
        status: stripeSubscription.status,
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        videosUsed: 0,
        videoLimit: plan.videoLimit,
      });

      await subscription.save();

      logger.info(`Subscription created for user ${userId}`, {
        subscriptionId: subscription._id,
        planId: plan.id,
      });

      return subscription.toObject() as UserSubscription;
    } catch (error) {
      logger.error("Error creating subscription", error);
      throw error;
    }
  }

  /**
   * Get active subscription for a user
   */
  async getActiveSubscription(
    userId: string
  ): Promise<UserSubscription | null> {
    try {
      const subscription = await Subscription.findOne({
        userId,
        status: { $in: ["active", "trialing", "pending"] },
      }).sort({ createdAt: -1 });

      return subscription
        ? (subscription.toObject() as UserSubscription)
        : null;
    } catch (error) {
      logger.error("Error getting active subscription", error);
      throw error;
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    data: UpdateSubscriptionData
  ): Promise<UserSubscription> {
    const { subscriptionId, planId, cancelAtPeriodEnd } = data;

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new NotFoundError("Subscription not found");
    }

    try {
      const updates: any = {};

      // Change plan
      if (planId) {
        const newPlan = this.getPlan(planId);
        if (!newPlan) {
          throw new NotFoundError("Invalid subscription plan");
        }

        const stripeSubscription = await stripeService.getSubscription(
          subscription.stripeSubscriptionId
        );

        await stripeService.updateSubscription(
          subscription.stripeSubscriptionId,
          {
            items: [
              {
                id: stripeSubscription.items.data[0].id,
                price: newPlan.stripePriceId,
              },
            ],
          }
        );

        updates.planId = planId;
        updates.videoLimit = newPlan.videoLimit;
      }

      // Cancel at period end
      if (cancelAtPeriodEnd !== undefined) {
        await stripeService.cancelSubscription(
          subscription.stripeSubscriptionId,
          cancelAtPeriodEnd
        );
        updates.cancelAtPeriodEnd = cancelAtPeriodEnd;
      }

      // Update database
      Object.assign(subscription, updates);
      await subscription.save();

      logger.info(`Subscription updated`, {
        subscriptionId,
        updates,
      });

      return subscription.toObject() as UserSubscription;
    } catch (error) {
      logger.error("Error updating subscription", error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<UserSubscription> {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new NotFoundError("Subscription not found");
    }

    try {
      await stripeService.cancelSubscription(
        subscription.stripeSubscriptionId,
        cancelAtPeriodEnd
      );

      if (!cancelAtPeriodEnd) {
        subscription.status = "canceled";
      }
      subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
      await subscription.save();

      logger.info(`Subscription canceled`, {
        subscriptionId,
        cancelAtPeriodEnd,
      });

      return subscription.toObject() as UserSubscription;
    } catch (error) {
      logger.error("Error canceling subscription", error);
      throw error;
    }
  }

  /**
   * Increment video usage
   */
  async incrementVideoUsage(userId: string): Promise<void> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      throw new NotFoundError("No active subscription found");
    }

    const dbSubscription = await Subscription.findById(subscription._id);
    if (dbSubscription) {
      dbSubscription.videosUsed += 1;
      await dbSubscription.save();
    }
  }

  /**
   * Get subscription usage
   */
  async getSubscriptionUsage(
    userId: string
  ): Promise<SubscriptionUsage | null> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      return null;
    }

    const remaining = Math.max(
      0,
      subscription.videoLimit - subscription.videosUsed
    );
    const percentageUsed =
      (subscription.videosUsed / subscription.videoLimit) * 100;

    return {
      videosUsed: subscription.videosUsed,
      videoLimit: subscription.videoLimit,
      remaining,
      percentageUsed: Math.round(percentageUsed),
    };
  }

  /**
   * Reset monthly usage (called by cron job)
   */
  async resetMonthlyUsage(): Promise<void> {
    try {
      const activeSubscriptions = await Subscription.find({
        status: { $in: ["active", "trialing"] },
      });

      for (const subscription of activeSubscriptions) {
        subscription.videosUsed = 0;
        await subscription.save();
      }

      logger.info(
        `Reset monthly usage for ${activeSubscriptions.length} subscriptions`
      );
    } catch (error) {
      logger.error("Error resetting monthly usage", error);
      throw error;
    }
  }

  /**
   * Sync subscription from Stripe
   */
  async syncFromStripe(userId: string): Promise<UserSubscription | null> {
    try {
      const subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        return null;
      }

      const stripeSubscription = await stripeService.getSubscription(
        subscription.stripeSubscriptionId
      );

      subscription.status = stripeSubscription.status as any;
      subscription.currentPeriodStart = new Date(
        stripeSubscription.current_period_start * 1000
      );
      subscription.currentPeriodEnd = new Date(
        stripeSubscription.current_period_end * 1000
      );
      subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

      await subscription.save();

      logger.info(`Subscription synced from Stripe for user ${userId}`);

      return subscription.toObject() as UserSubscription;
    } catch (error) {
      logger.error("Error syncing subscription from Stripe", error);
      throw error;
    }
  }
}

export const subscriptionService = new SubscriptionService();
