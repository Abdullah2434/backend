import { Request, Response } from "express";
import Stripe from "stripe";
import { SubscriptionService } from "../services/subscription.service";
import Billing from "../models/Billing";
import { ApiResponse } from "../types";

const subscriptionService = new SubscriptionService();

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).json({
      success: false,
      message: "Webhook secret not configured",
    });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
    });

    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      webhookSecret
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({
      success: false,
      message: "Invalid webhook signature",
    });
  }

  try {
    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ success: true, message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({
      success: false,
      message: "Error processing webhook",
    });
  }
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log("Subscription created:", subscription.id);

  // Update subscription status in database
  await subscriptionService.updateSubscriptionStatus(
    subscription.id,
    subscription.status
  );
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("Subscription updated:", subscription.id);

  // Update subscription status in database
  await subscriptionService.updateSubscriptionStatus(
    subscription.id,
    subscription.status
  );

  // If subscription is active and it's a new billing period, reset video count
  if (subscription.status === "active") {
    await subscriptionService.resetVideoCountForNewPeriod(subscription.id);
  }
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("Subscription deleted:", subscription.id);

  // Update subscription status in database
  await subscriptionService.updateSubscriptionStatus(
    subscription.id,
    "canceled"
  );
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log("Invoice payment succeeded:", invoice.id);

  if (invoice.subscription) {
    // Update billing record status
    await Billing.findOneAndUpdate(
      { stripeInvoiceId: invoice.id },
      { status: "succeeded" }
    );
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log("Invoice payment failed:", invoice.id);

  if (invoice.subscription) {
    // Update billing record status
    await Billing.findOneAndUpdate(
      { stripeInvoiceId: invoice.id },
      { status: "failed" }
    );

    // Update subscription status to past_due
    await subscriptionService.updateSubscriptionStatus(
      invoice.subscription as string,
      "past_due"
    );
  }
}

/**
 * Handle trial ending
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log("Trial will end for subscription:", subscription.id);

  // You can send email notifications here
  // await sendTrialEndingEmail(subscription.customer as string)
}
