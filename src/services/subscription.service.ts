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

    // Define subscription plans - Single monthly plan
    this.plans = [
      {
        id: "monthly",
        name: "Monthly Plan",
        price: parseInt(process.env.STRIPE_MONTHLY_PRICE || "99700", 10), // $997.00 in cents, configurable via env
        videoLimit: 30,
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
        const paymentIntentId =
          typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : invoice.payment_intent.id;

        await this.stripe.paymentIntents.update(paymentIntentId, {
          metadata: {
            subscriptionId: subscription.id,
            userId,
            planId: plan.id,
            planName: plan.name,
          },
        });
      }
    }


    // Return a temporary subscription object for API response
    // The actual database record will be created via manual sync endpoint
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
   * Update subscription status from Stripe
   */
  async updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: string
  ): Promise<void> {
  
    const subscription = await Subscription.findOne({ stripeSubscriptionId });

    if (subscription) {
     

      const oldStatus = subscription.status;
      subscription.status = status as any;

      // If status is changing to active, update the period dates
      if (status === "active" && oldStatus !== "active") {
      
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

         
        } catch (error) {
          
        }
      } else {
        
      }


      await subscription.save();

      // Verify the save was successful
      const verifySubscription = await Subscription.findOne({
        stripeSubscriptionId,
      });
      
    } else {
      

      // Additional debugging: List all subscriptions to see what's available
      const allSubscriptions = await Subscription.find({})
        .select("stripeSubscriptionId status planId")
        .limit(5);
    
    }
  }

  /**
   * Get subscription ID from payment intent
   * Tries multiple methods to find the subscription ID
   */
  async getSubscriptionIdFromPaymentIntent(
    paymentIntentId: string
  ): Promise<string | null> {
    try {
    

      const paymentIntent = await this.stripe.paymentIntents.retrieve(
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


        const invoice = await this.stripe.invoices.retrieve(invoiceId);
        if (invoice.subscription) {
          const subscriptionId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription.id;
        
          return subscriptionId;
        }

      }

     
      // Try to get customer ID from payment intent to narrow search
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

      const invoices = await this.stripe.invoices.list(searchParams);

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
   * Sync subscription status from Stripe (manual sync - creates or updates)
   * This is the primary method for syncing subscriptions after payment
   * Can accept either stripeSubscriptionId or paymentIntentId
   */
  async syncSubscriptionFromStripe(
    stripeSubscriptionIdOrPaymentIntentId: string,
    userId?: string
  ): Promise<UserSubscription> {
    // Declare outside try block for error logging
    let stripeSubscriptionId: string = stripeSubscriptionIdOrPaymentIntentId;

    try {
      let paymentIntentId: string | null = null;

      // Check if it's a payment intent ID (starts with "pi_")
      if (stripeSubscriptionIdOrPaymentIntentId.startsWith("pi_")) {
        paymentIntentId = stripeSubscriptionIdOrPaymentIntentId;
     

        // Get subscription ID from payment intent
        const foundSubscriptionId =
          await this.getSubscriptionIdFromPaymentIntent(paymentIntentId);

        if (!foundSubscriptionId) {
          throw new Error(
            `Could not find subscription ID for payment intent ${paymentIntentId}. The payment intent may not be linked to a subscription yet.`
          );
        }

        stripeSubscriptionId = foundSubscriptionId;
  
      }

      // Get subscription from Stripe
      const stripeSubscription = await this.stripe.subscriptions.retrieve(
        stripeSubscriptionId
      );


      // Get local subscription
      let localSubscription = await Subscription.findOne({
        stripeSubscriptionId,
      });

      // If subscription doesn't exist, create it from Stripe data
      if (!localSubscription) {
    

        // Get userId from metadata or parameter
        const subscriptionUserId =
          userId || stripeSubscription.metadata?.userId;

        if (!subscriptionUserId) {
          throw new Error(
            `Cannot create subscription: userId not found in metadata or parameter`
          );
        }

        // Create subscription using the webhook method
        // Note: createOrUpdateSubscriptionFromWebhook returns a formatted object,
        // so we need to get the Mongoose document from the database
        await this.createOrUpdateSubscriptionFromWebhook(
          stripeSubscription,
          {
            userId: subscriptionUserId,
            planId: stripeSubscription.metadata?.planId || "monthly",
            planName: stripeSubscription.metadata?.planName || "Monthly Plan",
          }
        );

        // Retrieve the Mongoose document we just created
        localSubscription = await Subscription.findOne({
          stripeSubscriptionId,
        });

        if (!localSubscription) {
          throw new Error(
            `Failed to retrieve subscription ${stripeSubscriptionId} after creation`
          );
        }

      } else {
        // Update existing subscription with all current data from Stripe
        const oldStatus = localSubscription.status;
        localSubscription.status = stripeSubscription.status as any;
        localSubscription.currentPeriodStart = new Date(
          stripeSubscription.current_period_start * 1000
        );
        localSubscription.currentPeriodEnd = new Date(
          stripeSubscription.current_period_end * 1000
        );
        localSubscription.cancelAtPeriodEnd =
          stripeSubscription.cancel_at_period_end;

        await localSubscription.save();


      }

      // Ensure billing records exist for all invoices of this subscription
      // This ensures the subscription ID is stored in the billing table
      await this.syncBillingRecordsForSubscription(
        localSubscription,
        stripeSubscription
      );

      // Return formatted subscription (localSubscription is a Mongoose document)
      return this.formatSubscription(localSubscription);
    } catch (error: any) {
      const subscriptionIdForLog =
        stripeSubscriptionId ||
        stripeSubscriptionIdOrPaymentIntentId ||
        "unknown";
    
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
  async getSubscriptionByStripeId(
    stripeSubscriptionId: string
  ): Promise<UserSubscription | null> {
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
  

    try {
      // Find the most recent subscription for this customer that might need syncing
      const localSubscription = await Subscription.findOne({
        stripeCustomerId,
        status: { $in: ["pending", "incomplete"] }, // Only sync subscriptions that need activation
      }).sort({ createdAt: -1 }); // Most recent first

      if (!localSubscription) {
  
        return;
      }


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
    
          // Update the subscription status
          await this.updateSubscriptionStatus(
            stripeSubscription.id,
            stripeSubscription.status
          );

        
        } else {
         
        }
      } else {
     
      }
    } catch (error) {
    
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
              planId: plan.id,
            },
          });

          // Retrieve the updated payment intent
          paymentIntent = await this.stripe.paymentIntents.retrieve(
            paymentIntent.id
          );
        } else {
          throw new Error("No payment intent found in subscription invoice");
        }
      } else {
        throw new Error("No invoice found in subscription");
      }


      // If payment intent already succeeded, automatically sync subscription
      if (paymentIntent.status === "succeeded") {
   
        try {
          const syncedSubscription = await this.syncSubscriptionFromStripe(
            paymentIntent.id,
            userId
          );
        

          return {
            paymentIntent,
            subscription: syncedSubscription,
          };
        } catch (syncError: any) {
       
        }
      }

      const result = {
        paymentIntent,
        subscription: {
          id: subscription.id,
          userId,
          planId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customer.id,
          status: "pending", // Will be updated when payment succeeds
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000
          ),
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

      }
      throw error;
    }
  }

  /**
   * Confirm payment intent and create subscription
   * Automatically syncs subscription after payment succeeds
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

   
    const userId = paymentIntent.metadata?.userId;
    const subscription = await this.syncSubscriptionFromStripe(
      paymentIntentId,
      userId
    );

  
    return subscription;
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
       
         await Subscription.find({ userId });
      

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

       
        } catch (stripeError) {
        
          // Still delete from database even if Stripe cancellation fails
          await Subscription.deleteOne({ _id: subscription._id });
        }
      }
    } catch (error) {
     
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
   * Sync billing records for a subscription - fetches all invoices and creates/updates billing records
   */
  private async syncBillingRecordsForSubscription(
    localSubscription: any,
    stripeSubscription: Stripe.Subscription
  ): Promise<void> {
    try {
     
      const invoices = await this.stripe.invoices.list({
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
     
          await this.createBillingRecord(
            localSubscription.userId.toString(),
            invoice,
            localSubscription._id.toString(),
            stripeSubscription.metadata?.planName || "Subscription"
          );
          createdCount++;
        } else if (!existingBilling.subscriptionId) {
          // Update existing billing record with subscription ID if missing
       
          existingBilling.subscriptionId = localSubscription._id;
          await existingBilling.save();
          updatedCount++;
        }
      }

  
    } catch (error: any) {
   
      // Don't throw - this is a non-critical operation
    }
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
      // Check if billing record already exists for this invoice
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
      let billingStatus = "pending";
      if (invoice.status === "paid") {
        billingStatus = "succeeded";
      } else if (invoice.status === "open") {
        billingStatus = "open";
      } else if (invoice.status === "void" || invoice.status === "uncollectible") {
        billingStatus = "failed";
      } else if (invoice.status === "draft") {
        billingStatus = "pending";
      }

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
        subscriptionId, // Always store subscription ID
      });

      await billing.save();
  
    } catch (error: any) {
      // If it's a duplicate key error (stripeInvoiceId already exists), update it
      if (error.code === 11000 && error.keyPattern?.stripeInvoiceId) {
   
        const existingBilling = await Billing.findOne({
          stripeInvoiceId: invoice.id,
        });
        if (existingBilling && !existingBilling.subscriptionId) {
          existingBilling.subscriptionId = subscriptionId as any;
          await existingBilling.save();
        }
      } else {
        throw error;
      }
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
   

    // Check if subscription already exists
    let existingSubscription = await Subscription.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (existingSubscription) {
   
      // Update existing subscription
      existingSubscription.status =
        stripeSubscription.status === "active" ? "active" : "pending";
      existingSubscription.currentPeriodStart = new Date(
        stripeSubscription.current_period_start * 1000
      );
      existingSubscription.currentPeriodEnd = new Date(
        stripeSubscription.current_period_end * 1000
      );
      existingSubscription.cancelAtPeriodEnd =
        stripeSubscription.cancel_at_period_end;

      await existingSubscription.save();

      // Sync billing records when updating existing subscription
      await this.syncBillingRecordsForSubscription(
        existingSubscription,
        stripeSubscription
      );

      return this.formatSubscription(existingSubscription);
    }


    // Get plan information from metadata or subscription items
    let planId = metadata?.planId;

    if (!planId && stripeSubscription.items.data.length > 0) {
      const priceId = stripeSubscription.items.data[0].price.id;
      

      // Find plan by price ID
      const plans = this.getPlans();
   
      const plan = plans.find(
        (p: SubscriptionPlan) => p.stripePriceId === priceId
      );
      planId = plan?.id;

    }

    if (!planId) {
     
      throw new Error(
        `Could not determine plan ID for subscription ${stripeSubscription.id}`
      );
    }

    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    // Get user ID from metadata
    const userId = metadata?.userId;
    if (!userId) {
      throw new Error(
        `User ID not found in subscription metadata for ${stripeSubscription.id}`
      );
    }

    const subscriptionRecord = new Subscription({
      userId,
      planId,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: stripeSubscription.customer as string,
      status: stripeSubscription.status === "active" ? "active" : "pending",
      currentPeriodStart: new Date(
        stripeSubscription.current_period_start * 1000
      ),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      videoLimit: plan.videoLimit,
      videoCount: 0,
    });

    await subscriptionRecord.save();

    // Sync all billing records for this subscription
    // This will create billing records for all invoices associated with this subscription
    await this.syncBillingRecordsForSubscription(
      subscriptionRecord,
      stripeSubscription
    );

 
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
