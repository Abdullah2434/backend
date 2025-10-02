import { Request, Response } from "express";
import Stripe from "stripe";
import { stripeService } from "../services/stripe.service";
import { billingService } from "../services/billing.service";
import Subscription from "../../../models/Subscription";
import { logger } from "../../../core/utils/logger";

export class StripeWebhookHandler {
  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error("Stripe webhook secret not configured");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripeService.constructWebhookEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (error: any) {
      logger.error("Webhook signature verification failed", error);
      res.status(400).json({ error: "Webhook signature verification failed" });
      return;
    }

    logger.info(`Processing Stripe webhook event: ${event.type}`);

    try {
      switch (event.type) {
        case "customer.subscription.created":
          await this.handleSubscriptionCreated(
            event.data.object as Stripe.Subscription
          );
          break;

        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription
          );
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription
          );
          break;

        case "invoice.paid":
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_failed":
          await this.handleInvoicePaymentFailed(
            event.data.object as Stripe.Invoice
          );
          break;

        case "customer.subscription.trial_will_end":
          await this.handleTrialWillEnd(
            event.data.object as Stripe.Subscription
          );
          break;

        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      logger.error("Error processing webhook event", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }

  /**
   * Handle subscription created
   */
  private async handleSubscriptionCreated(
    stripeSubscription: Stripe.Subscription
  ): Promise<void> {
    logger.info(`Subscription created: ${stripeSubscription.id}`);

    // Subscription should already exist in database (created during API call)
    // Just log for now
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(
    stripeSubscription: Stripe.Subscription
  ): Promise<void> {
    logger.info(`Subscription updated: ${stripeSubscription.id}`);

    const subscription = await Subscription.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (subscription) {
      subscription.status = stripeSubscription.status as any;
      subscription.currentPeriodStart = new Date(
        stripeSubscription.current_period_start * 1000
      );
      subscription.currentPeriodEnd = new Date(
        stripeSubscription.current_period_end * 1000
      );
      subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

      await subscription.save();
      logger.info(`Subscription ${subscription._id} updated from webhook`);
    }
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(
    stripeSubscription: Stripe.Subscription
  ): Promise<void> {
    logger.info(`Subscription deleted: ${stripeSubscription.id}`);

    const subscription = await Subscription.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (subscription) {
      subscription.status = "canceled";
      await subscription.save();
      logger.info(`Subscription ${subscription._id} canceled from webhook`);
    }
  }

  /**
   * Handle invoice paid
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    logger.info(`Invoice paid: ${invoice.id}`);

    if (!invoice.subscription) {
      return;
    }

    const subscription = await Subscription.findOne({
      stripeSubscriptionId: invoice.subscription as string,
    });

    if (subscription) {
      // Create billing record
      await billingService.createBillingRecord({
        userId: subscription.userId.toString(),
        subscriptionId: subscription._id.toString(),
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: "succeeded",
        invoiceId: `INV-${Date.now()}`,
        stripeInvoiceId: invoice.id,
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
        paidAt: new Date(),
      });

      // Reset monthly usage at the start of new billing period
      subscription.videoCount = 0;
      await subscription.save();

      logger.info(
        `Billing record created and usage reset for subscription ${subscription._id}`
      );
    }
  }

  /**
   * Handle invoice payment failed
   */
  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice
  ): Promise<void> {
    logger.error(`Invoice payment failed: ${invoice.id}`);

    if (!invoice.subscription) {
      return;
    }

    const subscription = await Subscription.findOne({
      stripeSubscriptionId: invoice.subscription as string,
    });

    if (subscription) {
      subscription.status = "past_due";
      await subscription.save();

      // Create failed billing record
      await billingService.createBillingRecord({
        userId: subscription.userId.toString(),
        subscriptionId: subscription._id.toString(),
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: "failed",
        invoiceId: `INV-${Date.now()}`,
        stripeInvoiceId: invoice.id,
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
      });

      logger.info(`Subscription ${subscription._id} marked as past_due`);
    }
  }

  /**
   * Handle trial will end
   */
  private async handleTrialWillEnd(
    stripeSubscription: Stripe.Subscription
  ): Promise<void> {
    logger.info(`Trial will end soon: ${stripeSubscription.id}`);

    // Could send email notification here
    // TODO: Implement trial ending notification
  }
}

export const stripeWebhookHandler = new StripeWebhookHandler();
