import Stripe from "stripe";
import Billing from "../../../models/Billing";
import Subscription from "../../../models/Subscription";
import {
  BillingRecord,
  BillingSummary,
  CreatePaymentIntentData,
  PaymentMethodData,
  SubscriptionConfig,
  NotFoundError,
  StripeError,
  PaymentError,
} from "../types/subscription.types";
import {
  logSubscriptionEvent,
  logSubscriptionError,
  getSubscriptionConfig,
  formatDate,
  formatAmount,
} from "../utils/subscription.utils";

export class SubscriptionBillingService {
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

  // ==================== PAYMENT INTENT MANAGEMENT ====================

  async createPaymentIntent(data: CreatePaymentIntentData): Promise<{
    id: string;
    clientSecret: string;
    status: string;
    amount: number;
    currency: string;
  }> {
    try {
      const subscription = await Subscription.findOne({ userId: data.userId });
      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: data.amount,
        currency: data.currency,
        customer: subscription.stripeCustomerId,
        payment_method: data.paymentMethodId,
        confirmation_method: "manual",
        confirm: false,
        description: data.description || "Subscription payment",
        metadata: {
          userId: data.userId,
          subscriptionId: subscription._id.toString(),
          ...data.metadata,
        },
      });

      logSubscriptionEvent("payment_intent_created", {
        userId: data.userId,
        paymentIntentId: paymentIntent.id,
        amount: data.amount,
      });

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId: data.userId,
        amount: data.amount,
        action: "createPaymentIntent",
      });
      throw new PaymentError("Failed to create payment intent");
    }
  }

  async confirmPaymentIntent(
    userId: string,
    paymentIntentId: string,
    paymentMethodId?: string
  ): Promise<{
    id: string;
    status: string;
    amount: number;
    currency: string;
  }> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethodId,
        }
      );

      if (paymentIntent.status === "succeeded") {
        // Create billing record
        await this.createBillingRecord({
          userId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: "paid",
          description: "Payment intent confirmed",
          stripePaymentIntentId: paymentIntent.id,
        });
      }

      logSubscriptionEvent("payment_intent_confirmed", {
        userId,
        paymentIntentId,
        status: paymentIntent.status,
      });

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId,
        paymentIntentId,
        action: "confirmPaymentIntent",
      });
      throw new PaymentError("Failed to confirm payment intent");
    }
  }

  async getPaymentIntentStatus(paymentIntentId: string): Promise<{
    id: string;
    status: string;
    amount: number;
    currency: string;
  }> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        paymentIntentId
      );

      logSubscriptionEvent("payment_intent_status_retrieved", {
        paymentIntentId,
        status: paymentIntent.status,
      });

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      logSubscriptionError(error as Error, {
        paymentIntentId,
        action: "getPaymentIntentStatus",
      });
      throw new PaymentError("Failed to retrieve payment intent status");
    }
  }

  // ==================== PAYMENT METHODS ====================

  async getPaymentMethods(userId: string): Promise<PaymentMethodData[]> {
    try {
      const subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        throw new NotFoundError("Subscription not found");
      }

      if (!subscription.stripeCustomerId) {
        return [];
      }

      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: subscription.stripeCustomerId,
        type: "card",
      });

      const formattedPaymentMethods: PaymentMethodData[] =
        paymentMethods.data.map((pm) => ({
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
          isDefault: false, // This would need to be determined from customer's default payment method
        }));

      logSubscriptionEvent("payment_methods_retrieved", {
        userId,
        count: formattedPaymentMethods.length,
      });

      return formattedPaymentMethods;
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId,
        action: "getPaymentMethods",
      });
      throw new StripeError("Failed to retrieve payment methods");
    }
  }

  // ==================== BILLING HISTORY ====================

  async getBillingHistory(userId: string): Promise<{
    billingHistory: BillingRecord[];
    total: number;
  }> {
    try {
      const billingRecords = await Billing.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50);

      const formattedRecords: BillingRecord[] = billingRecords.map(
        (record) => ({
          id: record._id.toString(),
          userId: record.userId,
          amount: record.amount,
          currency: record.currency,
          status: record.status,
          description: record.description,
          stripeInvoiceId: record.stripeInvoiceId,
          stripePaymentIntentId: record.stripePaymentIntentId,
          createdAt: formatDate(record.createdAt),
          paidAt: record.paidAt ? formatDate(record.paidAt) : undefined,
        })
      );

      const total = billingRecords.reduce(
        (sum, record) => sum + record.amount,
        0
      );

      logSubscriptionEvent("billing_history_retrieved", {
        userId,
        recordCount: formattedRecords.length,
        total,
      });

      return {
        billingHistory: formattedRecords,
        total,
      };
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId,
        action: "getBillingHistory",
      });
      throw new StripeError("Failed to retrieve billing history");
    }
  }

  async getBillingSummary(userId: string): Promise<BillingSummary> {
    try {
      const billingRecords = await Billing.find({ userId });

      const summary: BillingSummary = {
        totalPaid: 0,
        totalPending: 0,
        totalFailed: 0,
        currency: "usd",
        activeSubscriptions: 0,
      };

      let lastPaymentDate: Date | undefined;
      let nextPaymentDate: Date | undefined;

      billingRecords.forEach((record) => {
        switch (record.status) {
          case "paid":
            summary.totalPaid += record.amount;
            if (!lastPaymentDate || record.paidAt! > lastPaymentDate) {
              lastPaymentDate = record.paidAt;
            }
            break;
          case "pending":
            summary.totalPending += record.amount;
            break;
          case "failed":
            summary.totalFailed += record.amount;
            break;
        }
      });

      // Get subscription for next payment date
      const subscription = await Subscription.findOne({ userId });
      if (subscription && subscription.status === "active") {
        summary.activeSubscriptions = 1;
        nextPaymentDate = subscription.currentPeriodEnd;
      }

      summary.lastPaymentDate = lastPaymentDate
        ? formatDate(lastPaymentDate)
        : undefined;
      summary.nextPaymentDate = nextPaymentDate
        ? formatDate(nextPaymentDate)
        : undefined;

      logSubscriptionEvent("billing_summary_retrieved", {
        userId,
        totalPaid: summary.totalPaid,
        activeSubscriptions: summary.activeSubscriptions,
      });

      return summary;
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId,
        action: "getBillingSummary",
      });
      throw new StripeError("Failed to retrieve billing summary");
    }
  }

  // ==================== BILLING RECORD MANAGEMENT ====================

  private async createBillingRecord(data: {
    userId: string;
    amount: number;
    currency: string;
    status: string;
    description: string;
    stripeInvoiceId?: string;
    stripePaymentIntentId?: string;
  }): Promise<void> {
    try {
      const billingRecord = new Billing({
        userId: data.userId,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        description: data.description,
        stripeInvoiceId: data.stripeInvoiceId,
        stripePaymentIntentId: data.stripePaymentIntentId,
        paidAt: data.status === "paid" ? new Date() : undefined,
      });

      await billingRecord.save();

      logSubscriptionEvent("billing_record_created", {
        userId: data.userId,
        amount: data.amount,
        status: data.status,
      });
    } catch (error) {
      logSubscriptionError(error as Error, {
        userId: data.userId,
        action: "createBillingRecord",
      });
      throw new StripeError("Failed to create billing record");
    }
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
      await this.stripe.paymentIntents.list({ limit: 1 });

      // Test database connection
      await Billing.findOne().limit(1);

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

export default SubscriptionBillingService;
