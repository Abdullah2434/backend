import Stripe from "stripe";
import mongoose from "mongoose";
import Subscription, { ISubscription } from "../models/Subscription";
import Billing from "../models/Billing";
import User from "../models/User";
import {
  SubscriptionPlan,
  UserSubscription,
  CreateSubscriptionData,
  CreatePaymentIntentData,
  UpdateSubscriptionData,
  PaymentMethodData,
} from "../types";

export class SubscriptionService {
  private stripe: Stripe;
  private plans: SubscriptionPlan[];

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

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
      throw new Error("Invalid subscription plan");
    }

    // Check if user already has an active subscription
    const existingSubscription = await this.getActiveSubscription(userId);
    if (existingSubscription) {
      throw new Error("User already has an active subscription");
    }

    // Get or create Stripe customer
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    let customer: Stripe.Customer;
    const existingCustomer = await this.findStripeCustomer(user.email);

    if (existingCustomer) {
      customer = existingCustomer;
    } else {
      customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        payment_method: paymentMethodId,
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    // Attach payment method to customer
    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    // Create subscription
    const subscription = await this.stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: plan.stripePriceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        userId,
        planId: plan.id,
        planName: plan.name,
      },
      description: `Subscription for ${plan.name}`,
    });

    // CRITICAL FIX: Add subscription ID to payment intent metadata
    // This ensures webhooks can link payment success back to subscription
    if (subscription.latest_invoice) {
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      if (invoice.payment_intent) {
        const paymentIntentId = typeof invoice.payment_intent === "string" 
          ? invoice.payment_intent 
          : invoice.payment_intent.id;
        
        await this.stripe.paymentIntents.update(paymentIntentId, {
          metadata: {
            subscriptionId: subscription.id,
            userId,
            planId: plan.id,
            planName: plan.name
          }
        });
      }
    }

    // DO NOT create subscription record here - wait for webhook confirmation
    // The subscription record will be created when checkout.session.completed 
    // or invoice.payment_succeeded webhook is received
    console.log(`📝 Stripe subscription created: ${subscription.id}, waiting for payment confirmation via webhook`);

    // Return a temporary subscription object for API response
    // The actual database record will be created via webhook
    return {
      id: subscription.id,
      userId,
      planId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customer.id,
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

  /**
   * Get user's active subscription
   */
  async getActiveSubscription(
    userId: string
  ): Promise<UserSubscription | null> {
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ["active", "pending"] }, // Include pending subscriptions
    }).populate("userId");

    // If subscription exists but is past due, don't consider it active
    if (subscription && subscription.status === "pending") {
      // Check if the subscription is still within the current period
      const now = new Date();
      if (now > subscription.currentPeriodEnd) {
        // Mark as past_due and return null
        subscription.status = "past_due";
        await subscription.save();
        return null;
      }
    }

    return subscription ? this.formatSubscription(subscription) : null;
  }

  /**
   * Check if user has any existing subscription (including incomplete ones)
   */
  async hasExistingSubscription(userId: string): Promise<{
    hasActive: boolean;
    hasPending: boolean;
    hasIncomplete: boolean;
    activeSubscription?: UserSubscription;
  }> {
    const subscriptions = await Subscription.find({
      userId,
      status: { $in: ["active", "pending", "incomplete", "past_due"] },
    });

    const activeSub = subscriptions.find((sub) => sub.status === "active");
    const pendingSub = subscriptions.find((sub) => sub.status === "pending");
    const incompleteSub = subscriptions.find(
      (sub) => sub.status === "incomplete"
    );

    return {
      hasActive: !!activeSub,
      hasPending: !!pendingSub,
      hasIncomplete: !!incompleteSub,
      activeSubscription: activeSub
        ? this.formatSubscription(activeSub)
        : undefined,
    };
  }

  /**
   * Check if user has existing subscription for specific plan
   */
  async hasExistingSubscriptionForPlan(
    userId: string,
    planId: string
  ): Promise<{
    hasActive: boolean;
    hasPending: boolean;
    hasIncomplete: boolean;
    existingSubscription?: UserSubscription;
  }> {
    const subscriptions = await Subscription.find({
      userId,
      planId,
      status: { $in: ["active", "pending", "incomplete", "past_due"] },
    });

    const activeSub = subscriptions.find((sub) => sub.status === "active");
    const pendingSub = subscriptions.find((sub) => sub.status === "pending");
    const incompleteSub = subscriptions.find(
      (sub) => sub.status === "incomplete"
    );

    return {
      hasActive: !!activeSub,
      hasPending: !!pendingSub,
      hasIncomplete: !!incompleteSub,
      existingSubscription: activeSub
        ? this.formatSubscription(activeSub)
        : undefined,
    };
  }

  /**
   * Check if user has any successful payment for a plan (including billing records)
   */
  async hasSuccessfulPaymentForPlan(
    userId: string,
    planId: string
  ): Promise<boolean> {
    // Check for active subscription
    const activeSubscription = await Subscription.findOne({
      userId,
      planId,
      status: "active",
    });

    if (activeSubscription) {
      return true;
    }

    // Check for successful billing records for this plan
    const successfulPayment = await Billing.findOne({
      userId,
      status: "succeeded",
    }).populate("subscriptionId");

    if (successfulPayment && successfulPayment.subscriptionId) {
      const subscription = await Subscription.findById(
        successfulPayment.subscriptionId
      );
      if (subscription && subscription.planId === planId) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user can create a video
   */
  async canCreateVideo(
    userId: string
  ): Promise<{ canCreate: boolean; remaining: number; limit: number }> {
    const subscription = await this.getActiveSubscription(userId);

    if (!subscription) {
      return { canCreate: false, remaining: 0, limit: 0 };
    }

    const remaining = Math.max(
      0,
      subscription.videoLimit - subscription.videoCount
    );
    const canCreate = remaining > 0;

    return { canCreate, remaining, limit: subscription.videoLimit };
  }

  /**
   * Increment video count for user
   */
  async incrementVideoCount(userId: string): Promise<void> {
    const subscription = await Subscription.findOne({
      userId,
      status: "active",
    });

    if (subscription) {
      subscription.videoCount += 1;
      await subscription.save();
    }
  }

  /**
   * Update subscription status from Stripe webhook
   */
  async updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: string
  ): Promise<void> {
    console.log(`🔍 Looking for subscription with Stripe ID: ${stripeSubscriptionId}`);
    const subscription = await Subscription.findOne({ stripeSubscriptionId });
    
    if (subscription) {
      console.log(`✅ Found subscription in database:`, {
        id: subscription._id,
        userId: subscription.userId,
        currentStatus: subscription.status,
        planId: subscription.planId,
        stripeCustomerId: subscription.stripeCustomerId
      });
      
      console.log(
        `🔄 Updating subscription ${stripeSubscriptionId} status from ${subscription.status} to ${status}`
      );

      const oldStatus = subscription.status;
      subscription.status = status as any;

      // If status is changing to active, update the period dates
      if (status === "active" && oldStatus !== "active") {
        console.log(`🎉 Subscription is becoming active! Updating period dates...`);
        try {
          // Get the latest subscription data from Stripe to ensure we have current period info
          const stripeSubscription = await this.stripe.subscriptions.retrieve(
            stripeSubscriptionId
          );

          subscription.currentPeriodStart = new Date(
            stripeSubscription.current_period_start * 1000
          );
          subscription.currentPeriodEnd = new Date(
            stripeSubscription.current_period_end * 1000
          );

          console.log(
            `📅 Updated period dates for subscription ${stripeSubscriptionId}:`,
            {
              start: subscription.currentPeriodStart,
              end: subscription.currentPeriodEnd,
            }
          );
        } catch (error) {
          console.error(
            `❌ Failed to fetch Stripe subscription data for ${stripeSubscriptionId}:`,
            error
          );
        }
      } else {
        console.log(`ℹ️ Status change from ${oldStatus} to ${status} - no period update needed`);
      }

      console.log(`💾 Saving subscription to database...`);
      await subscription.save();
      
      // Verify the save was successful
      const verifySubscription = await Subscription.findOne({ stripeSubscriptionId });
      console.log(`✅ Database save verification: Status is now ${verifySubscription?.status}`);
      
      console.log(
        `🎯 Successfully updated subscription ${stripeSubscriptionId} status to ${status}`
      );
    } else {
      console.error(
        `❌ Subscription not found for stripeSubscriptionId: ${stripeSubscriptionId}`
      );
      
      // Additional debugging: List all subscriptions to see what's available
      const allSubscriptions = await Subscription.find({}).select('stripeSubscriptionId status planId').limit(5);
      console.log(`🔍 Available subscriptions in database:`, allSubscriptions);
    }
  }

  /**
   * Sync subscription status from Stripe (manual sync for webhook failures)
   */
  async syncSubscriptionFromStripe(
    stripeSubscriptionId: string
  ): Promise<void> {
    try {
      // Get subscription from Stripe
      const stripeSubscription = await this.stripe.subscriptions.retrieve(
        stripeSubscriptionId
      );

      console.log(
        `Syncing subscription ${stripeSubscriptionId} from Stripe status: ${stripeSubscription.status}`
      );

      // Get local subscription
      const localSubscription = await Subscription.findOne({
        stripeSubscriptionId,
      });

      if (!localSubscription) {
        throw new Error(`Local subscription not found for ${stripeSubscriptionId}`);
      }

      // Update local subscription with all current data from Stripe
      const oldStatus = localSubscription.status;
      localSubscription.status = stripeSubscription.status as any;
      localSubscription.currentPeriodStart = new Date(
        stripeSubscription.current_period_start * 1000
      );
      localSubscription.currentPeriodEnd = new Date(
        stripeSubscription.current_period_end * 1000
      );
      localSubscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

      await localSubscription.save();

      console.log(
        `Successfully synced subscription ${stripeSubscriptionId} status from ${oldStatus} to ${localSubscription.status}`
      );
    } catch (error) {
      console.error(
        `Error syncing subscription ${stripeSubscriptionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await Subscription.findOne({
      userId,
      status: "active",
    });

    if (!subscription) {
      throw new Error("No active subscription found");
    }

    // Cancel in Stripe
    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update local record
    subscription.cancelAtPeriodEnd = true;
    await subscription.save();
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(userId: string): Promise<void> {
    const subscription = await Subscription.findOne({
      userId,
      status: "active",
      cancelAtPeriodEnd: true,
    });

    if (!subscription) {
      throw new Error("No subscription found to reactivate");
    }

    // Reactivate in Stripe
    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update local record
    subscription.cancelAtPeriodEnd = false;
    await subscription.save();
  }

  /**
   * Get user's payment methods
   */
  async getPaymentMethods(userId: string): Promise<PaymentMethodData[]> {
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      return [];
    }

    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: subscription.stripeCustomerId,
      type: "card",
    });

    return paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: pm.card
        ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          }
        : undefined,
      isDefault: pm.id === subscription.stripeCustomerId,
    }));
  }

  /**
   * Reset video count for new billing period
   */
  async resetVideoCountForNewPeriod(
    stripeSubscriptionId: string
  ): Promise<void> {
    const subscription = await Subscription.findOne({ stripeSubscriptionId });
    if (subscription) {
      subscription.videoCount = 0;
      subscription.currentPeriodStart = new Date();
      subscription.currentPeriodEnd = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ); // 30 days
      await subscription.save();
    }
  }

  /**
   * Get subscription by Stripe subscription ID for verification
   */
  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<UserSubscription | null> {
    const subscription = await Subscription.findOne({ stripeSubscriptionId });
    return subscription ? this.formatSubscription(subscription) : null;
  }

  /**
   * FALLBACK METHOD: Sync subscription status by finding recent subscription for customer
   * This handles cases where payment intent metadata doesn't include subscription ID
   */
  async syncRecentSubscriptionByCustomer(
    stripeCustomerId: string,
    paymentIntentId: string
  ): Promise<void> {
    console.log(`🔍 Searching for recent subscription for customer: ${stripeCustomerId}`);
    
    try {
      // Find the most recent subscription for this customer that might need syncing
      const localSubscription = await Subscription.findOne({
        stripeCustomerId,
        status: { $in: ["pending", "incomplete"] } // Only sync subscriptions that need activation
      }).sort({ createdAt: -1 }); // Most recent first

      if (!localSubscription) {
        console.log(`📭 No pending subscriptions found for customer ${stripeCustomerId}`);
        return;
      }

      console.log(`🎯 Found potential subscription to sync: ${localSubscription.stripeSubscriptionId}`);

      // Get the latest subscription data from Stripe
      const stripeSubscription = await this.stripe.subscriptions.retrieve(
        localSubscription.stripeSubscriptionId
      );

      // Check if this subscription's latest invoice matches our payment intent
      if (stripeSubscription.latest_invoice) {
        const invoice = await this.stripe.invoices.retrieve(
          stripeSubscription.latest_invoice as string
        );
        
        if (invoice.payment_intent === paymentIntentId) {
          console.log(`✅ Confirmed subscription ${stripeSubscription.id} matches payment intent ${paymentIntentId}`);
          
          // Update the subscription status
          await this.updateSubscriptionStatus(
            stripeSubscription.id,
            stripeSubscription.status
          );
          
          console.log(`🎉 Successfully synced subscription ${stripeSubscription.id} status to ${stripeSubscription.status}`);
        } else {
          console.log(`⚠️ Payment intent mismatch. Expected: ${paymentIntentId}, Found: ${invoice.payment_intent}`);
        }
      } else {
        console.log(`⚠️ Subscription ${stripeSubscription.id} has no latest_invoice`);
      }
    } catch (error) {
      console.error(`❌ Error in syncRecentSubscriptionByCustomer for customer ${stripeCustomerId}:`, error);
      throw error;
    }
  }

  /**
   * Create a Stripe payment intent for subscription
   */
  async createPaymentIntent(data: CreatePaymentIntentData): Promise<{
    paymentIntent: Stripe.PaymentIntent;
    subscription: UserSubscription;
  }> {
    try {
      const { userId, planId, customerEmail, customerName } = data;

      // Get the plan
      const plan = this.getPlan(planId);
      if (!plan) {
        throw new Error("Invalid subscription plan");
      }

      // Check for existing subscriptions for this specific plan
      const existingSubsForPlan = await this.hasExistingSubscriptionForPlan(
        userId,
        planId
      );

      // Also check for successful payments for this plan
      const hasSuccessfulPayment = await this.hasSuccessfulPaymentForPlan(
        userId,
        planId
      );

      if (existingSubsForPlan.hasActive || hasSuccessfulPayment) {
        throw new Error(
          `You already have an active ${plan.name} subscription. Please cancel your current subscription before creating a new one.`
        );
      }

      if (existingSubsForPlan.hasPending || existingSubsForPlan.hasIncomplete) {
        // Automatically clean up incomplete subscriptions for this plan
        await this.cleanupIncompleteSubscriptions(userId);

        // Check again after cleanup
        const subsAfterCleanup = await this.hasExistingSubscriptionForPlan(
          userId,
          planId
        );
        if (subsAfterCleanup.hasActive || subsAfterCleanup.hasPending) {
          throw new Error(
            `You already have a ${plan.name} subscription. Please wait for it to complete or contact support.`
          );
        }
      }

      // Also check for any other active subscriptions (different plans)
      const existingSubs = await this.hasExistingSubscription(userId);
      if (existingSubs.hasActive && !existingSubsForPlan.hasActive) {
        throw new Error(
          "You already have an active subscription for a different plan. Please cancel your current subscription before creating a new one."
        );
      }

      // Get or create Stripe customer
      let customer: Stripe.Customer;
      const existingCustomer = await this.findStripeCustomer(customerEmail);

      if (existingCustomer) {
        customer = existingCustomer;
      } else {
        customer = await this.stripe.customers.create({
          email: customerEmail,
          name: customerName,
        });
      }

      // Create subscription with payment intent
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: plan.stripePriceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          userId,
          planId: plan.id,
          planName: plan.name,
        },
        description: `Subscription for ${plan.name}`,
      });

      // Get the payment intent from the subscription's invoice
      let paymentIntent: Stripe.PaymentIntent;
      if (subscription.latest_invoice) {
        const invoice = subscription.latest_invoice as Stripe.Invoice;
        if (invoice.payment_intent) {
          paymentIntent =
            typeof invoice.payment_intent === "string"
              ? await this.stripe.paymentIntents.retrieve(
                  invoice.payment_intent
                )
              : invoice.payment_intent;
          
          // CRITICAL FIX: Add subscription ID to payment intent metadata
          // This allows the webhook to find and update the subscription
          await this.stripe.paymentIntents.update(paymentIntent.id, {
            metadata: {
              ...paymentIntent.metadata,
              subscriptionId: subscription.id,
              userId: userId,
              planId: plan.id
            }
          });
          
          // Retrieve the updated payment intent
          paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntent.id);
        } else {
          throw new Error("No payment intent found in subscription invoice");
        }
      } else {
        throw new Error("No invoice found in subscription");
      }

      // DO NOT create subscription record here - wait for webhook confirmation
      // The subscription record will be created when checkout.session.completed 
      // or invoice.payment_succeeded webhook is received
      console.log(`📝 Stripe subscription created: ${subscription.id}, waiting for payment confirmation via webhook`);

      const result = {
        paymentIntent,
        subscription: {
          id: subscription.id,
          userId,
          planId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customer.id,
          status: "pending", // Will be updated via webhook
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          videoLimit: plan.videoLimit,
          videoCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as UserSubscription,
      };

      return result;
    } catch (error: any) {
      // Cleanup any incomplete subscriptions on error
      try {
        await this.cleanupIncompleteSubscriptions(data.userId);
      } catch (cleanupError) {
        console.error("Error during automatic cleanup:", cleanupError);
      }
      throw error;
    }
  }

  /**
   * Confirm payment intent and create subscription
   */
  async confirmPaymentIntentAndCreateSubscription(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<UserSubscription> {
    // Retrieve the payment intent
    const paymentIntent = await this.stripe.paymentIntents.retrieve(
      paymentIntentId
    );

    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment intent is not succeeded");
    }

    const { subscriptionId } = paymentIntent.metadata;

    if (!subscriptionId) {
      throw new Error("No subscription ID found in payment intent metadata");
    }

    // Get the latest subscription data from Stripe to ensure we have current status
    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      subscriptionId
    );

    console.log(`Stripe subscription status: ${stripeSubscription.status}`);

    // Get the subscription from database
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: subscriptionId,
    });
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Update subscription status based on Stripe's current status
    const oldStatus = subscription.status;
    subscription.status = stripeSubscription.status as any;

    // If subscription is now active, update period dates
    if (stripeSubscription.status === "active") {
      subscription.currentPeriodStart = new Date(
        stripeSubscription.current_period_start * 1000
      );
      subscription.currentPeriodEnd = new Date(
        stripeSubscription.current_period_end * 1000
      );

      console.log(
        `Updated subscription ${subscriptionId} to active with period:`,
        {
          start: subscription.currentPeriodStart,
          end: subscription.currentPeriodEnd,
        }
      );
    }

    await subscription.save();

    console.log(
      `Subscription ${subscriptionId} status updated from ${oldStatus} to ${subscription.status}`
    );

    return this.formatSubscription(subscription);
  }

  /**
   * Get payment intent status
   */
  async getPaymentIntentStatus(
    paymentIntentId: string
  ): Promise<Stripe.PaymentIntent> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(
      paymentIntentId
    );
    return paymentIntent;
  }

  /**
   * Upgrade or downgrade subscription plan
   */
  async changePlan(
    userId: string,
    newPlanId: string
  ): Promise<UserSubscription> {
    try {
      // Ensure userId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user ID format");
      }

      // Get current subscription
      const currentSubscription = await this.getActiveSubscription(userId);
      if (!currentSubscription) {
        throw new Error("No active subscription found");
      }

      // Get the new plan
      const newPlan = this.getPlan(newPlanId);
      if (!newPlan) {
        throw new Error("Invalid plan ID");
      }

      // Check if it's actually a change
      if (currentSubscription.planId === newPlanId) {
        throw new Error("User is already on this plan");
      }

      // Get current Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.retrieve(
        currentSubscription.stripeSubscriptionId
      );

      // Update Stripe subscription with new price
      const updatedStripeSubscription = await this.stripe.subscriptions.update(
        stripeSubscription.id,
        {
          items: [
            {
              id: stripeSubscription.items.data[0].id,
              price: newPlan.stripePriceId,
            },
          ],
          proration_behavior: "create_prorations", // Handle price differences
        }
      );

      // Update local subscription record
      const subscription = await Subscription.findOne({
        userId,
        status: { $in: ["active", "pending"] }, // Include pending subscriptions
      });

      if (!subscription) {
        console.error(
          `Subscription not found for userId: ${userId}, status: active or pending`
        );
        console.error(`Current subscription data:`, currentSubscription);

        // Debug: Check what subscriptions exist for this user
        const allUserSubscriptions = await Subscription.find({ userId });
        console.error(
          `All subscriptions for user ${userId}:`,
          allUserSubscriptions.map((sub) => ({
            id: sub._id,
            status: sub.status,
            planId: sub.planId,
            stripeSubscriptionId: sub.stripeSubscriptionId,
          }))
        );

        throw new Error("Subscription record not found in database");
      }

      subscription.planId = newPlanId;
      subscription.videoLimit = newPlan.videoLimit;
      subscription.currentPeriodStart = new Date(
        updatedStripeSubscription.current_period_start * 1000
      );
      subscription.currentPeriodEnd = new Date(
        updatedStripeSubscription.current_period_end * 1000
      );

      await subscription.save();

      return this.formatSubscription(subscription);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get plan upgrade/downgrade options
   */
  getPlanChangeOptions(currentPlanId: string): {
    upgrades: SubscriptionPlan[];
    downgrades: SubscriptionPlan[];
    currentPlan: SubscriptionPlan;
  } {
    const currentPlan = this.getPlan(currentPlanId);
    if (!currentPlan) {
      throw new Error("Current plan not found");
    }

    const upgrades = this.plans.filter(
      (plan) => plan.price > currentPlan.price
    );

    const downgrades = this.plans.filter(
      (plan) => plan.price < currentPlan.price
    );

    return {
      upgrades,
      downgrades,
      currentPlan,
    };
  }

  /**
   * Clean up incomplete/failed subscriptions for a user (private method)
   */
  private async cleanupIncompleteSubscriptions(userId: string): Promise<void> {
    try {
      // Find incomplete subscriptions in database
      const incompleteSubscriptions = await Subscription.find({
        userId,
        status: { $in: ["pending", "incomplete", "past_due"] },
      });

      for (const subscription of incompleteSubscriptions) {
        try {
          // Cancel the subscription in Stripe
          await this.stripe.subscriptions.cancel(
            subscription.stripeSubscriptionId
          );

          // Delete from database
          await Subscription.deleteOne({ _id: subscription._id });

          console.log(
            `Auto-cleaned up incomplete subscription: ${subscription.stripeSubscriptionId}`
          );
        } catch (stripeError) {
          console.error(
            `Error canceling subscription ${subscription.stripeSubscriptionId}:`,
            stripeError
          );
          // Still delete from database even if Stripe cancellation fails
          await Subscription.deleteOne({ _id: subscription._id });
        }
      }
    } catch (error) {
      console.error("Error during automatic subscription cleanup:", error);
    }
  }

  /**
   * Find Stripe customer by email
   */
  private async findStripeCustomer(
    email: string
  ): Promise<Stripe.Customer | null> {
    const customers = await this.stripe.customers.list({
      email,
      limit: 1,
    });
    return customers.data[0] || null;
  }

  /**
   * Create billing record
   */
  private async createBillingRecord(
    userId: string,
    invoice: Stripe.Invoice,
    subscriptionId: string,
    planName?: string
  ): Promise<void> {
    try {
      // Get plan name from subscription if not provided
      let description = "Subscription payment";
      if (planName) {
        description = `Subscription payment for ${planName}`;
      } else {
        // Try to get plan name from subscription
        const subscription = await Subscription.findById(subscriptionId);
        if (subscription) {
          const plan = this.getPlan(subscription.planId);
          if (plan) {
            description = `Subscription payment for ${plan.name}`;
          }
        }
      }

      const billing = new Billing({
        userId,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status || "pending",
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId:
          typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : invoice.payment_intent?.id || null,
        description,
        subscriptionId,
      });

      await billing.save();
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get user's billing history (transaction history)
   */
  async getBillingHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    transactions: any[];
    total: number;
    hasMore: boolean;
  }> {
    const { limit = 20, offset = 0, status, startDate, endDate } = options;

    // Build query
    const query: any = { userId };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    // Get total count
    const total = await Billing.countDocuments(query);

    // Get transactions with pagination
    const transactions = await Billing.find(query)
      .populate("subscriptionId", "planId stripeSubscriptionId")
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // Format transactions for API response
    const formattedTransactions = transactions.map((transaction: any) => ({
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
      // Add formatted amount for display
      formattedAmount: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: transaction.currency.toUpperCase(),
      }).format(transaction.amount / 100), // Stripe amounts are in cents
    }));

    return {
      transactions: formattedTransactions,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get billing summary for user
   */
  async getBillingSummary(userId: string): Promise<{
    totalTransactions: number;
    totalAmount: number;
    successfulPayments: number;
    failedPayments: number;
    lastPaymentDate: Date | null;
    nextBillingDate: Date | null;
  }> {
    const [
      totalTransactions,
      successfulPayments,
      failedPayments,
      lastPayment,
      subscription,
    ] = await Promise.all([
      Billing.countDocuments({ userId }),
      Billing.countDocuments({ userId, status: "succeeded" }),
      Billing.countDocuments({ userId, status: "failed" }),
      Billing.findOne({ userId, status: "succeeded" })
        .sort({ createdAt: -1 })
        .select("createdAt amount"),
      Subscription.findOne({ userId, status: "active" }).select(
        "currentPeriodEnd"
      ),
    ]);

    // Calculate total amount from successful payments
    const totalAmountResult = await Billing.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: "succeeded",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalAmount = totalAmountResult[0]?.total || 0;

    return {
      totalTransactions,
      totalAmount,
      successfulPayments,
      failedPayments,
      lastPaymentDate: lastPayment?.createdAt || null,
      nextBillingDate: subscription?.currentPeriodEnd || null,
    };
  }

  /**
   * Create or update subscription from webhook (after successful payment)
   */
  async createOrUpdateSubscriptionFromWebhook(
    stripeSubscription: Stripe.Subscription,
    metadata?: { [key: string]: string }
  ): Promise<UserSubscription> {
    console.log(`🔄 Creating/updating subscription from webhook: ${stripeSubscription.id}`);
    
    // Check if subscription already exists
    let existingSubscription = await Subscription.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (existingSubscription) {
      console.log(`📝 Updating existing subscription ${stripeSubscription.id}`);
      // Update existing subscription
      existingSubscription.status = stripeSubscription.status === "active" ? "active" : "pending";
      existingSubscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
      existingSubscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
      existingSubscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
      
      await existingSubscription.save();
      return this.formatSubscription(existingSubscription);
    }

    // Create new subscription record
    console.log(`🆕 Creating new subscription record for ${stripeSubscription.id}`);
    
    // Get plan information from metadata or subscription items
    let planId = metadata?.planId;
    if (!planId && stripeSubscription.items.data.length > 0) {
      const priceId = stripeSubscription.items.data[0].price.id;
      // Find plan by price ID
      const plans = this.getPlans();
      const plan = plans.find((p: SubscriptionPlan) => p.stripePriceId === priceId);
      planId = plan?.id;
    }

    if (!planId) {
      throw new Error(`Could not determine plan ID for subscription ${stripeSubscription.id}`);
    }

    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    // Get user ID from metadata
    const userId = metadata?.userId;
    if (!userId) {
      throw new Error(`User ID not found in subscription metadata for ${stripeSubscription.id}`);
    }

    const subscriptionRecord = new Subscription({
      userId,
      planId,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: stripeSubscription.customer as string,
      status: stripeSubscription.status === "active" ? "active" : "pending",
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      videoLimit: plan.videoLimit,
      videoCount: 0,
    });

    await subscriptionRecord.save();

    // Create billing record if there's an invoice
    if (stripeSubscription.latest_invoice) {
      const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
      if (invoice.id && invoice.amount_due !== undefined) {
        await this.createBillingRecord(
          userId,
          invoice,
          subscriptionRecord._id,
          plan.name
        );
      }
    }

    console.log(`✅ Successfully created subscription record for ${stripeSubscription.id}`);
    return this.formatSubscription(subscriptionRecord);
  }

  /**
   * Format subscription for API response
   */
  private formatSubscription(subscription: ISubscription): UserSubscription {
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
}
