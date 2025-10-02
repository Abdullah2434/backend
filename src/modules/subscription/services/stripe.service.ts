import Stripe from "stripe";
import { env } from "../../../config/environment";
import { logger } from "../../../core/utils/logger";

export class StripeService {
  private stripe: Stripe;

  constructor() {
    const stripeSecretKey = env.getRequired("STRIPE_SECRET_KEY") as string;
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });
  }

  /**
   * Get Stripe instance
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }

  /**
   * Create a customer
   */
  async createCustomer(
    email: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.create({
        email,
        metadata,
      });
    } catch (error) {
      logger.error("Error creating Stripe customer", error);
      throw error;
    }
  }

  /**
   * Get customer
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      return (await this.stripe.customers.retrieve(
        customerId
      )) as Stripe.Customer;
    } catch (error) {
      logger.error("Error retrieving Stripe customer", error);
      throw error;
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    updates: Stripe.CustomerUpdateParams
  ): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.update(customerId, updates);
    } catch (error) {
      logger.error("Error updating Stripe customer", error);
      throw error;
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata,
      });
    } catch (error) {
      logger.error("Error creating Stripe subscription", error);
      throw error;
    }
  }

  /**
   * Get subscription
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      logger.error("Error retrieving Stripe subscription", error);
      throw error;
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: Stripe.SubscriptionUpdateParams
  ): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.update(subscriptionId, updates);
    } catch (error) {
      logger.error("Error updating Stripe subscription", error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Stripe.Subscription> {
    try {
      if (cancelAtPeriodEnd) {
        return await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        return await this.stripe.subscriptions.cancel(subscriptionId);
      }
    } catch (error) {
      logger.error("Error canceling Stripe subscription", error);
      throw error;
    }
  }

  /**
   * Create payment intent
   */
  async createPaymentIntent(
    amount: number,
    currency: string = "usd",
    customerId?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        metadata,
      });
    } catch (error) {
      logger.error("Error creating payment intent", error);
      throw error;
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<Stripe.PaymentMethod> {
    try {
      return await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    } catch (error) {
      logger.error("Error attaching payment method", error);
      throw error;
    }
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (error) {
      logger.error("Error setting default payment method", error);
      throw error;
    }
  }

  /**
   * List customer payment methods
   */
  async listPaymentMethods(
    customerId: string
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });
      return paymentMethods.data;
    } catch (error) {
      logger.error("Error listing payment methods", error);
      throw error;
    }
  }

  /**
   * Detach payment method
   */
  async detachPaymentMethod(
    paymentMethodId: string
  ): Promise<Stripe.PaymentMethod> {
    try {
      return await this.stripe.paymentMethods.detach(paymentMethodId);
    } catch (error) {
      logger.error("Error detaching payment method", error);
      throw error;
    }
  }

  /**
   * List invoices for customer
   */
  async listInvoices(
    customerId: string,
    limit: number = 10
  ): Promise<Stripe.Invoice[]> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit,
      });
      return invoices.data;
    } catch (error) {
      logger.error("Error listing invoices", error);
      throw error;
    }
  }

  /**
   * Construct webhook event
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
    } catch (error) {
      logger.error("Error constructing webhook event", error);
      throw error;
    }
  }
}

export const stripeService = new StripeService();
