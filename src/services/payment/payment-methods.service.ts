import Stripe from "stripe";
import Subscription from "../../models/Subscription";
import User from "../../models/User";
import { CardInfo, SetupIntentData } from "../../types";

export class PaymentMethodsService {
  private stripe: Stripe;

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });
  }

  /**
   * Get or create Stripe customer for user
   */
  private async getOrCreateCustomer(userId: string): Promise<string> {
    // First, check if user has an existing subscription with customer ID
    const subscription = await Subscription.findOne({ userId });
    if (subscription?.stripeCustomerId) {
      return subscription.stripeCustomerId;
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
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

    return customer.id;
  }

  /**
   * Get all saved payment methods for user
   */
  async getPaymentMethods(userId: string): Promise<CardInfo[]> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      // Get customer to find default payment method
      const customer = await this.stripe.customers.retrieve(customerId);
      const defaultPaymentMethodId = typeof customer !== 'string' && !customer.deleted
        ? customer.invoice_settings?.default_payment_method 
        : null;

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      return paymentMethods.data.map((pm) => {
        const expYear = pm.card?.exp_year || 0;
        const expMonth = pm.card?.exp_month || 0;
        const isExpired = expYear < currentYear || (expYear === currentYear && expMonth < currentMonth);

        return {
          id: pm.id,
          brand: pm.card?.brand || 'unknown',
          last4: pm.card?.last4 || '0000',
          expMonth: expMonth,
          expYear: expYear,
          isDefault: pm.id === defaultPaymentMethodId,
          isExpired: isExpired,
        };
      });
    } catch (error) {
 
      throw new Error("Failed to fetch payment methods");
    }
  }

  /**
   * Create SetupIntent for adding/updating payment method
   */
  async createSetupIntent(userId: string): Promise<SetupIntentData> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session', // For future payments
        metadata: {
          userId: userId,
        },
      });

      return {
        setupIntent: {
          id: setupIntent.id,
          client_secret: setupIntent.client_secret!,
          status: setupIntent.status,
        },
        customer: {
          id: customerId,
        },
      };
    } catch (error) {
    
      throw new Error("Failed to create setup intent");
    }
  }

  /**
   * Confirm SetupIntent and optionally set as default
   */
  async confirmSetupIntent(
    userId: string, 
    setupIntentId: string, 
    setAsDefault: boolean = false
  ): Promise<CardInfo> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      // Retrieve the setup intent to get the payment method
      const setupIntent = await this.stripe.setupIntents.retrieve(setupIntentId);

      if (setupIntent.status !== 'succeeded') {
        throw new Error('Setup intent not succeeded');
      }

      if (!setupIntent.payment_method) {
        throw new Error('No payment method found in setup intent');
      }

      const paymentMethodId = setupIntent.payment_method as string;

      // Get payment method details
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);

      // Set as default if requested
      if (setAsDefault) {
        await this.stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });

        // Also update any active subscriptions
        const subscription = await Subscription.findOne({ 
          userId, 
          status: { $in: ['active', 'pending'] } 
        });
        
        if (subscription) {
          try {
            await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
              default_payment_method: paymentMethodId,
            });
          } catch (subscriptionError: any) {

          }
        }
      }

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const expYear = paymentMethod.card?.exp_year || 0;
      const expMonth = paymentMethod.card?.exp_month || 0;
      const isExpired = expYear < currentYear || (expYear === currentYear && expMonth < currentMonth);

      return {
        id: paymentMethod.id,
        brand: paymentMethod.card?.brand || 'unknown',
        last4: paymentMethod.card?.last4 || '0000',
        expMonth: expMonth,
        expYear: expYear,
        isDefault: setAsDefault,
        isExpired: isExpired,
      };
    } catch (error) {
    
      throw new Error("Failed to confirm setup intent");
    }
  }

  /**
   * Set a payment method as default
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      // Verify payment method belongs to customer
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== customerId) {
        throw new Error("Payment method does not belong to customer");
      }

      // Set as default for customer
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Update active subscription default payment method
      // Only update subscription if it's active or pending (not canceled)
      const subscription = await Subscription.findOne({ 
        userId, 
        status: { $in: ['active', 'pending'] } 
      });
      
      if (subscription) {
        try {
          await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            default_payment_method: paymentMethodId,
          });
        } catch (subscriptionError: any) {
        

        }
      }
    } catch (error) {
     
      throw new Error("Failed to set default payment method");
    }
  }

  /**
   * Remove a payment method
   */
  async removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    try {
      const customerId = await this.getOrCreateCustomer(userId);

      // Verify payment method belongs to customer
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== customerId) {
        throw new Error("Payment method does not belong to customer");
      }

      // Check if this is the only payment method
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      if (paymentMethods.data.length <= 1) {
        throw new Error("Cannot remove the last payment method");
      }

      // Detach payment method
      await this.stripe.paymentMethods.detach(paymentMethodId);
    } catch (error) {
  
      throw new Error("Failed to remove payment method");
    }
  }
}
