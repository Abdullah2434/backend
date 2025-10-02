import { stripeService } from "./stripe.service";
import User from "../../../models/User";
import { logger } from "../../../core/utils/logger";
import { NotFoundError } from "../../../core/errors";
import {
  PaymentMethodData,
  CreatePaymentIntentData,
} from "../types/subscription.types";

export class PaymentService {
  /**
   * Create payment intent
   */
  async createPaymentIntent(data: CreatePaymentIntentData): Promise<any> {
    const { userId, amount, currency = "usd", metadata } = data;

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    try {
      const paymentIntent = await stripeService.createPaymentIntent(
        amount,
        currency,
        user.stripeCustomerId,
        metadata
      );

      logger.info(`Payment intent created for user ${userId}`, {
        paymentIntentId: paymentIntent.id,
        amount,
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error) {
      logger.error("Error creating payment intent", error);
      throw error;
    }
  }

  /**
   * Add payment method to user
   */
  async addPaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<PaymentMethodData> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    try {
      // Create Stripe customer if doesn't exist
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
      const paymentMethod = await stripeService.attachPaymentMethod(
        paymentMethodId,
        stripeCustomerId
      );

      logger.info(`Payment method added for user ${userId}`, {
        paymentMethodId,
      });

      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card
          ? {
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              expMonth: paymentMethod.card.exp_month,
              expYear: paymentMethod.card.exp_year,
            }
          : undefined,
        isDefault: false,
      };
    } catch (error) {
      logger.error("Error adding payment method", error);
      throw error;
    }
  }

  /**
   * Get user's payment methods
   */
  async getPaymentMethods(userId: string): Promise<PaymentMethodData[]> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.stripeCustomerId) {
      return [];
    }

    try {
      const customer = await stripeService.getCustomer(user.stripeCustomerId);
      const paymentMethods = await stripeService.listPaymentMethods(
        user.stripeCustomerId
      );

      const defaultPaymentMethodId =
        typeof customer.invoice_settings?.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings?.default_payment_method?.id;

      return paymentMethods.map((pm) => ({
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
        isDefault: pm.id === defaultPaymentMethodId,
      }));
    } catch (error) {
      logger.error("Error getting payment methods", error);
      throw error;
    }
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user || !user.stripeCustomerId) {
      throw new NotFoundError("User or Stripe customer not found");
    }

    try {
      await stripeService.setDefaultPaymentMethod(
        user.stripeCustomerId,
        paymentMethodId
      );

      logger.info(`Default payment method set for user ${userId}`, {
        paymentMethodId,
      });
    } catch (error) {
      logger.error("Error setting default payment method", error);
      throw error;
    }
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    try {
      await stripeService.detachPaymentMethod(paymentMethodId);

      logger.info(`Payment method removed for user ${userId}`, {
        paymentMethodId,
      });
    } catch (error) {
      logger.error("Error removing payment method", error);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
