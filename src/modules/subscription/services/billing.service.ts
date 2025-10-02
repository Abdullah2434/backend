import Billing from "../../../models/Billing";
import Subscription from "../../../models/Subscription";
import { stripeService } from "./stripe.service";
import { logger } from "../../../core/utils/logger";
import { NotFoundError } from "../../../core/errors";
import { BillingHistory } from "../types/subscription.types";

export class BillingService {
  /**
   * Get billing history for a user
   */
  async getBillingHistory(
    userId: string,
    limit: number = 10
  ): Promise<BillingHistory[]> {
    try {
      const billingRecords = await Billing.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit);

      return billingRecords.map(
        (record) => record.toObject() as BillingHistory
      );
    } catch (error) {
      logger.error("Error getting billing history", error);
      throw error;
    }
  }

  /**
   * Create billing record
   */
  async createBillingRecord(data: {
    userId: string;
    subscriptionId: string;
    amount: number;
    currency: string;
    status: "succeeded" | "pending" | "failed";
    invoiceId: string;
    stripeInvoiceId: string;
    periodStart: Date;
    periodEnd: Date;
    paidAt?: Date;
  }): Promise<BillingHistory> {
    try {
      const billingRecord = new Billing(data);
      await billingRecord.save();

      logger.info(`Billing record created`, {
        userId: data.userId,
        invoiceId: data.invoiceId,
      });

      return billingRecord.toObject() as BillingHistory;
    } catch (error) {
      logger.error("Error creating billing record", error);
      throw error;
    }
  }

  /**
   * Get billing summary for a user
   */
  async getBillingSummary(userId: string): Promise<any> {
    try {
      const subscription = await Subscription.findOne({
        userId,
        status: { $in: ["active", "trialing"] },
      });

      if (!subscription) {
        return {
          subscription: null,
          totalPaid: 0,
          billingHistory: [],
        };
      }

      // Get total paid
      const totalPaidResult = await Billing.aggregate([
        {
          $match: {
            userId: subscription.userId,
            status: "succeeded",
          },
        },
        {
          $group: {
            _id: null,
            totalPaid: { $sum: "$amount" },
          },
        },
      ]);

      const totalPaid =
        totalPaidResult.length > 0 ? totalPaidResult[0].totalPaid : 0;

      // Get recent billing history
      const billingHistory = await this.getBillingHistory(userId, 5);

      return {
        subscription: subscription.toObject(),
        totalPaid,
        billingHistory,
        nextBillingDate: subscription.currentPeriodEnd,
      };
    } catch (error) {
      logger.error("Error getting billing summary", error);
      throw error;
    }
  }

  /**
   * Sync billing from Stripe invoices
   */
  async syncFromStripe(userId: string): Promise<void> {
    try {
      const subscription = await Subscription.findOne({ userId });
      if (!subscription || !subscription.stripeCustomerId) {
        throw new NotFoundError("Subscription not found");
      }

      // Get invoices from Stripe
      const invoices = await stripeService.listInvoices(
        subscription.stripeCustomerId,
        20
      );

      for (const invoice of invoices) {
        // Check if billing record already exists
        const existingRecord = await Billing.findOne({
          stripeInvoiceId: invoice.id,
        });

        if (!existingRecord && invoice.status === "paid") {
          await this.createBillingRecord({
            userId: subscription.userId.toString(),
            subscriptionId: subscription._id.toString(),
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
            invoiceId: `INV-${Date.now()}`,
            stripeInvoiceId: invoice.id,
            periodStart: new Date(invoice.period_start * 1000),
            periodEnd: new Date(invoice.period_end * 1000),
            paidAt: invoice.status_transitions?.paid_at
              ? new Date(invoice.status_transitions.paid_at * 1000)
              : new Date(),
          });
        }
      }

      logger.info(`Billing synced from Stripe for user ${userId}`);
    } catch (error) {
      logger.error("Error syncing billing from Stripe", error);
      throw error;
    }
  }
}

export const billingService = new BillingService();
