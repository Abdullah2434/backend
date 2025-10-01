import Stripe from "stripe";
import {
  StripeWebhookEventData,
  WebhookHandlerResult,
  WebhookProcessingResult,
  WebhookConfig,
  SignatureError,
  ProcessingError,
} from "../types/webhook.types";
import {
  logWebhookEvent,
  logWebhookError,
  getWebhookConfig,
  maskEventId,
  formatEventType,
} from "../utils/webhook.utils";

export class WebhookProcessingService {
  private readonly config: WebhookConfig;
  private readonly stripe: Stripe;

  constructor() {
    this.config = {
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
      apiVersion: "2023-10-16",
      endpointSecret: process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET || "",
      tolerance: 300,
      enableLogging: true,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitWindow: 60000,
      rateLimitMax: 100,
    };

    if (!this.config.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }

    if (!this.config.webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET environment variable is required");
    }

    this.stripe = new Stripe(this.config.stripeSecretKey, {
      apiVersion: this.config.apiVersion as any,
    });
  }

  // ==================== WEBHOOK VERIFICATION ====================

  async verifyWebhookSignature(
    payload: Buffer,
    signature: string
  ): Promise<StripeWebhookEventData> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.webhookSecret
      );

      logWebhookEvent("webhook_signature_verified", {
        eventId: maskEventId(event.id),
        eventType: event.type,
        created: event.created,
      });

      return event as StripeWebhookEventData;
    } catch (error) {
      logWebhookError(error as Error, {
        action: "verifyWebhookSignature",
        signature: signature.substring(0, 20) + "...",
      });
      throw new SignatureError("Invalid webhook signature");
    }
  }

  // ==================== EVENT PROCESSING ====================

  async processWebhookEvent(
    event: StripeWebhookEventData
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();

    try {
      logWebhookEvent("webhook_processing_started", {
        eventId: maskEventId(event.id),
        eventType: event.type,
        created: event.created,
      });

      // Process the event based on its type
      const result = await this.handleEventByType(event);

      const processingTime = Date.now() - startTime;

      logWebhookEvent("webhook_processing_completed", {
        eventId: maskEventId(event.id),
        eventType: event.type,
        processingTime: `${processingTime}ms`,
        success: true,
      });

      return {
        processed: true,
        eventId: event.id,
        eventType: event.type,
        success: true,
        metadata: {
          processingTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logWebhookError(error as Error, {
        eventId: maskEventId(event.id),
        eventType: event.type,
        processingTime,
        action: "processWebhookEvent",
      });

      return {
        processed: false,
        eventId: event.id,
        eventType: event.type,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          processingTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // ==================== EVENT HANDLERS ====================

  private async handleEventByType(
    event: StripeWebhookEventData
  ): Promise<void> {
    const { type, data } = event;

    switch (type) {
      case "checkout.session.completed":
        await this.handleCheckoutSessionCompleted(data.object);
        break;
      case "customer.subscription.created":
        await this.handleSubscriptionCreated(data.object);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(data.object);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(data.object);
        break;
      case "invoice.payment_succeeded":
        await this.handleInvoicePaymentSucceeded(data.object);
        break;
      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(data.object);
        break;
      case "payment_intent.succeeded":
        await this.handlePaymentIntentSucceeded(data.object);
        break;
      case "payment_intent.payment_failed":
        await this.handlePaymentIntentFailed(data.object);
        break;
      default:
        logWebhookEvent("unhandled_event_type", {
          eventId: maskEventId(event.id),
          eventType: type,
        });
        break;
    }
  }

  // ==================== SPECIFIC EVENT HANDLERS ====================

  private async handleCheckoutSessionCompleted(session: any): Promise<void> {
    logWebhookEvent("checkout_session_completed", {
      sessionId: session.id,
      customerId: session.customer,
      subscriptionId: session.subscription,
      mode: session.mode,
    });

    // This would typically trigger subscription creation
    console.log("🎉 Checkout session completed:", session.id);
  }

  private async handleSubscriptionCreated(subscription: any): Promise<void> {
    logWebhookEvent("subscription_created", {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      planId: subscription.items?.data?.[0]?.price?.id,
    });

    // This would typically create subscription record
    console.log("📝 Subscription created:", subscription.id);
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    logWebhookEvent("subscription_updated", {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    // This would typically update subscription record
    console.log("📝 Subscription updated:", subscription.id);
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    logWebhookEvent("subscription_deleted", {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
    });

    // This would typically mark subscription as deleted
    console.log("🗑️ Subscription deleted:", subscription.id);
  }

  private async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    logWebhookEvent("invoice_payment_succeeded", {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      subscriptionId: invoice.subscription,
      amountPaid: invoice.amount_paid,
    });

    // This would typically update billing records
    console.log("💰 Invoice payment succeeded:", invoice.id);
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    logWebhookEvent("invoice_payment_failed", {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      subscriptionId: invoice.subscription,
      amountDue: invoice.amount_due,
    });

    // This would typically handle payment failure
    console.log("❌ Invoice payment failed:", invoice.id);
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: any
  ): Promise<void> {
    logWebhookEvent("payment_intent_succeeded", {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });

    // This would typically update payment records
    console.log("✅ Payment intent succeeded:", paymentIntent.id);
  }

  private async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    logWebhookEvent("payment_intent_failed", {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });

    // This would typically handle payment failure
    console.log("❌ Payment intent failed:", paymentIntent.id);
  }

  // ==================== UTILITY METHODS ====================

  async isEventProcessed(eventId: string): Promise<boolean> {
    try {
      // This would typically check a database or cache
      // For now, we'll return false (not processed)
      return false;
    } catch (error) {
      logWebhookError(error as Error, { eventId, action: "isEventProcessed" });
      return false;
    }
  }

  async markEventAsProcessed(eventId: string): Promise<void> {
    try {
      // This would typically store in a database or cache
      logWebhookEvent("event_marked_as_processed", {
        eventId: maskEventId(eventId),
      });
    } catch (error) {
      logWebhookError(error as Error, {
        eventId,
        action: "markEventAsProcessed",
      });
    }
  }

  // ==================== CONFIGURATION ====================

  getConfig(): WebhookConfig {
    return { ...this.config };
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      stripe: "available" | "unavailable";
      webhook: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      // Test Stripe connection
      await this.stripe.webhookEndpoints.list({ limit: 1 });

      return {
        status: "healthy",
        services: {
          stripe: "available",
          webhook: "available",
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          stripe: "unavailable",
          webhook: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default WebhookProcessingService;
