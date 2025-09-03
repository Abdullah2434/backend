import Stripe from "stripe";
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
    });

    // Create subscription record in database
    const subscriptionRecord = new Subscription({
      userId,
      planId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customer.id,
      status: subscription.status === "active" ? "active" : "pending",
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      videoLimit: plan.videoLimit,
      videoCount: 0,
    });

    await subscriptionRecord.save();

    // Create billing record
    if (subscription.latest_invoice) {
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      await this.createBillingRecord(userId, invoice, subscriptionRecord._id);
    }

    return this.formatSubscription(subscriptionRecord);
  }

  /**
   * Get user's active subscription
   */
  async getActiveSubscription(
    userId: string
  ): Promise<UserSubscription | null> {
    const subscription = await Subscription.findOne({
      userId,
      status: "active",
    }).populate("userId");

    return subscription ? this.formatSubscription(subscription) : null;
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
    const subscription = await Subscription.findOne({ stripeSubscriptionId });
    if (subscription) {
      subscription.status = status as any;
      await subscription.save();
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

      // Check if user already has an active subscription
      const existingSubscription = await this.getActiveSubscription(userId);
      if (existingSubscription) {
        throw new Error("User already has an active subscription");
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

      // Create subscription FIRST
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: plan.stripePriceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });

      // Create subscription record in database
      const subscriptionRecord = new Subscription({
        userId,
        planId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customer.id,
        status: subscription.status === "active" ? "active" : "pending",
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        videoLimit: plan.videoLimit,
        videoCount: 0,
      });

      await subscriptionRecord.save();

      // Create billing record
      if (subscription.latest_invoice) {
        const invoice = subscription.latest_invoice as Stripe.Invoice;

        // Only create billing record if invoice has required fields
        if (invoice.id && invoice.amount_due !== undefined) {
          await this.createBillingRecord(
            userId,
            invoice,
            subscriptionRecord._id
          );
        }
      }

      // Create payment intent for the subscription
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: plan.price,
        currency: "usd",
        customer: customer.id,
        metadata: {
          userId,
          planId,
          subscriptionId: subscription.id,
          type: "subscription",
        },
        description: `Subscription payment for ${plan.name}`,
        automatic_payment_methods: {
          enabled: true,
        },
        setup_future_usage: "off_session", // For future subscription payments
      });

      const result = {
        paymentIntent,
        subscription: this.formatSubscription(subscriptionRecord),
      };

      return result;
    } catch (error: any) {
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

    // Get the subscription from database
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: subscriptionId,
    });
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Update subscription status if needed
    if (subscription.status !== "active") {
      subscription.status = "active";
      await subscription.save();
    }

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
        status: "active",
      });
      if (subscription) {
        subscription.planId = newPlanId;
        subscription.videoLimit = newPlan.videoLimit;
        subscription.currentPeriodStart = new Date(
          updatedStripeSubscription.current_period_start * 1000
        );
        subscription.currentPeriodEnd = new Date(
          updatedStripeSubscription.current_period_end * 1000
        );

        await subscription.save();
      }

      return this.formatSubscription(subscription!);
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
    subscriptionId: string
  ): Promise<void> {
    try {
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
        description: `Subscription payment - ${
          invoice.description || "Monthly subscription"
        }`,
        subscriptionId,
      });

      await billing.save();
    } catch (error: any) {
      throw error;
    }
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
