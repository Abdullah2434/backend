import Stripe from "stripe";
import Subscription from "../../../models/Subscription";
import User from "../../../models/User";
import {
  PaymentMethod,
  SetupIntentData,
  CardInfo,
  CustomerData,
  PaymentConfig,
  PaymentError,
  NotFoundError,
  StripeError,
  PaymentStats,
} from "../types/payment.types";
import {
  logPaymentEvent,
  logPaymentError,
  getPaymentConfig,
  formatCardNumber,
  formatCardBrand,
  formatDate,
} from "../utils/payment.utils";

export class PaymentService {
  private readonly config: PaymentConfig;
  private readonly stripe: Stripe;

  constructor() {
    this.config = {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
      apiVersion: "2023-10-16",
      currency: "usd",
      returnUrl:
        process.env.PAYMENT_RETURN_URL || "https://www.edgeairealty.com",
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 10,
    };

    if (!this.config.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }

    this.stripe = new Stripe(this.config.stripeSecretKey, {
      apiVersion: this.config.apiVersion as any,
    });
  }

  // ==================== CUSTOMER MANAGEMENT ====================

  private async getOrCreateCustomer(userId: string): Promise<string> {
    try {
      // First, check if user has an existing subscription with customer ID
      const subscription = await Subscription.findOne({ userId });
      if (subscription?.stripeCustomerId) {
        return subscription.stripeCustomerId;
      }

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Check if customer already exists in Stripe by email
      const existingCustomers = await this.stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0].id;
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: userId,
        },
      });

      logPaymentEvent("customer_created", { userId, customerId: customer.id });
      return customer.id;
    } catch (error) {
      logPaymentError(error as Error, {
        userId,
        action: "getOrCreateCustomer",
      });
      throw new PaymentError("Failed to get or create customer", 500);
    }
  }

  // ==================== PAYMENT METHODS ====================

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      // Get all payment methods for the customer
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      const formattedPaymentMethods: PaymentMethod[] = paymentMethods.data.map(
        (pm) => ({
          id: pm.id,
          type: pm.type,
          card: pm.card
            ? {
                brand: formatCardBrand(pm.card.brand),
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year,
              }
            : undefined,
          isDefault: false, // This would need to be determined from customer's default payment method
          createdAt: formatDate(new Date(pm.created * 1000)),
        })
      );

      logPaymentEvent("payment_methods_retrieved", {
        userId,
        count: formattedPaymentMethods.length,
      });

      return formattedPaymentMethods;
    } catch (error) {
      logPaymentError(error as Error, { userId, action: "getPaymentMethods" });
      throw new PaymentError("Failed to retrieve payment methods", 500);
    }
  }

  async createSetupIntent(
    userId: string,
    returnUrl?: string
  ): Promise<SetupIntentData> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
        confirm: false,
        return_url: returnUrl || this.config.returnUrl,
      });

      logPaymentEvent("setup_intent_created", {
        userId,
        setupIntentId: setupIntent.id,
      });

      return {
        setupIntentId: setupIntent.id,
        clientSecret: setupIntent.client_secret!,
        returnUrl: returnUrl || this.config.returnUrl,
      };
    } catch (error) {
      logPaymentError(error as Error, { userId, action: "createSetupIntent" });
      throw new PaymentError("Failed to create setup intent", 500);
    }
  }

  async updatePaymentMethod(
    userId: string,
    setupIntentId: string,
    paymentMethodId?: string
  ): Promise<PaymentMethod> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      // Confirm the setup intent
      const setupIntent = await this.stripe.setupIntents.confirm(
        setupIntentId,
        {
          payment_method: paymentMethodId,
        }
      );

      if (setupIntent.status !== "succeeded") {
        throw new PaymentError("Setup intent confirmation failed", 400);
      }

      // Get the payment method details
      const paymentMethod = await this.stripe.paymentMethods.retrieve(
        setupIntent.payment_method as string
      );

      const formattedPaymentMethod: PaymentMethod = {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card
          ? {
              brand: formatCardBrand(paymentMethod.card.brand),
              last4: paymentMethod.card.last4,
              expMonth: paymentMethod.card.exp_month,
              expYear: paymentMethod.card.exp_year,
            }
          : undefined,
        isDefault: false,
        createdAt: formatDate(new Date(paymentMethod.created * 1000)),
      };

      logPaymentEvent("payment_method_updated", {
        userId,
        paymentMethodId: paymentMethod.id,
      });

      return formattedPaymentMethod;
    } catch (error) {
      logPaymentError(error as Error, {
        userId,
        setupIntentId,
        action: "updatePaymentMethod",
      });
      throw new PaymentError("Failed to update payment method", 500);
    }
  }

  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<PaymentMethod> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      // Update customer's default payment method
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Get the payment method details
      const paymentMethod = await this.stripe.paymentMethods.retrieve(
        paymentMethodId
      );

      const formattedPaymentMethod: PaymentMethod = {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card
          ? {
              brand: formatCardBrand(paymentMethod.card.brand),
              last4: paymentMethod.card.last4,
              expMonth: paymentMethod.card.exp_month,
              expYear: paymentMethod.card.exp_year,
            }
          : undefined,
        isDefault: true,
        createdAt: formatDate(new Date(paymentMethod.created * 1000)),
      };

      logPaymentEvent("default_payment_method_set", {
        userId,
        paymentMethodId,
      });

      return formattedPaymentMethod;
    } catch (error) {
      logPaymentError(error as Error, {
        userId,
        paymentMethodId,
        action: "setDefaultPaymentMethod",
      });
      throw new PaymentError("Failed to set default payment method", 500);
    }
  }

  async removePaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<void> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      // Detach the payment method from the customer
      await this.stripe.paymentMethods.detach(paymentMethodId);

      logPaymentEvent("payment_method_removed", {
        userId,
        paymentMethodId,
      });
    } catch (error) {
      logPaymentError(error as Error, {
        userId,
        paymentMethodId,
        action: "removePaymentMethod",
      });
      throw new PaymentError("Failed to remove payment method", 500);
    }
  }

  // ==================== UTILITY METHODS ====================

  async getCustomer(userId: string): Promise<CustomerData | null> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);
      const customer = await this.stripe.customers.retrieve(customerId);

      if (typeof customer === "string" || customer.deleted) {
        return null;
      }

      return {
        id: customer.id,
        email: customer.email || "",
        name: customer.name || "",
        metadata: {
          userId: customer.metadata.userId || "",
        },
      };
    } catch (error) {
      logPaymentError(error as Error, { userId, action: "getCustomer" });
      return null;
    }
  }

  async getPaymentStats(userId: string): Promise<PaymentStats> {
    try {
      const paymentMethods = await this.getPaymentMethods(userId);
      const customer = await this.getCustomer(userId);

      return {
        totalPaymentMethods: paymentMethods.length,
        defaultPaymentMethod: paymentMethods.find((pm) => pm.isDefault),
        lastUpdated: formatDate(new Date()),
      };
    } catch (error) {
      logPaymentError(error as Error, { userId, action: "getPaymentStats" });
      throw new PaymentError("Failed to get payment stats", 500);
    }
  }

  // ==================== CONFIGURATION ====================

  getConfig(): PaymentConfig {
    return { ...this.config };
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

      return {
        status: "healthy",
        services: {
          stripe: "available",
          database: "available",
        },
        timestamp: formatDate(new Date()),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          stripe: "unavailable",
          database: "unavailable",
        },
        timestamp: formatDate(new Date()),
      };
    }
  }
}

export default PaymentService;
