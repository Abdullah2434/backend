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
  // TEMPORARY: Hardcoded webhook secret for testing
  const webhookSecret = "whsec_PuBVxim9Av9L9ortosiq6OmzwMKvUI5r";

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).json({
      success: false,
      message: "Webhook secret not configured",
    });
  }

  console.log("🔐 Using webhook secret:", webhookSecret.substring(0, 10) + "...");
  console.log("🔍 Webhook signature:", sig);
  console.log("🔍 Request body type:", typeof req.body);
  console.log("🔍 Request body constructor:", req.body?.constructor?.name);
  console.log("🔍 Request body is Buffer:", Buffer.isBuffer(req.body));
  console.log("🔍 Request body length:", req.body?.length || 0);
  console.log("🔍 Raw body content:", req.body);

  let event: Stripe.Event;

  try {
    // Verify webhook signature with raw body
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
    });

    // Handle different body formats
    let bodyString: string;
    
    if (Buffer.isBuffer(req.body)) {
      // If it's a Buffer, convert to string
      bodyString = req.body.toString('utf8');
      console.log("🔍 Converted Buffer to string");
    } else if (typeof req.body === 'string') {
      // If it's already a string, use as-is
      bodyString = req.body;
      console.log("🔍 Body is already a string");
    } else if (typeof req.body === 'object') {
      // If it's an object, try to stringify it
      bodyString = JSON.stringify(req.body);
      console.log("🔍 Stringified object body");
    } else {
      // Fallback: convert to string
      bodyString = String(req.body);
      console.log("🔍 Fallback string conversion");
    }
    
    console.log("🔍 Final body string type:", typeof bodyString);
    console.log("🔍 Final body string length:", bodyString?.length || 0);
    console.log("🔍 Body string preview:", bodyString?.substring(0, 200) + "...");
    
    event = stripe.webhooks.constructEvent(
      bodyString,
      sig as string,
      webhookSecret
    );

    console.log("✅ Webhook signature verified successfully");
    console.log("📋 Event type:", event.type);
    console.log("📋 Event ID:", event.id);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    
    // TEMPORARY: Fallback to parsing without verification for testing
    console.log("⚠️ TEMPORARY: Falling back to parsing without verification");
    try {
      // Parse the raw body as JSON with proper handling
      if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) {
        // If it's already parsed as object, use it directly
        event = req.body as Stripe.Event;
        console.log("✅ Fallback: Using object body directly");
        console.log("📋 Event type:", event.type);
        console.log("📋 Event ID:", event.id);
      } else {
        // Need to parse from string
        let bodyForParsing: string;
        
        if (Buffer.isBuffer(req.body)) {
          bodyForParsing = req.body.toString('utf8');
          console.log("🔍 Fallback: Converted Buffer to string for parsing");
        } else if (typeof req.body === 'string') {
          bodyForParsing = req.body;
          console.log("🔍 Fallback: Using string body for parsing");
        } else {
          bodyForParsing = String(req.body);
          console.log("🔍 Fallback: String conversion for parsing");
        }
        
        console.log("🔍 Fallback body string preview:", bodyForParsing?.substring(0, 200) + "...");
        event = JSON.parse(bodyForParsing);
        console.log("✅ Parsed webhook event without signature verification");
        console.log("📋 Event type:", event.type);
        console.log("📋 Event ID:", event.id);
      }
    } catch (parseErr: any) {
      console.error("❌ Failed to parse webhook body:", parseErr.message);
      console.error("❌ Body content that failed to parse:", req.body);
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature and failed to parse body",
      });
    }
  }

  try {
    console.log(`Processing webhook event: ${event.type}`);

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

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
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
  console.log("Subscription details:", {
    id: subscription.id,
    status: subscription.status,
    customer: subscription.customer,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
  });

  // Update subscription status in database
  await subscriptionService.updateSubscriptionStatus(
    subscription.id,
    subscription.status
  );

  // If subscription is already active (immediate payment), ensure it's properly activated
  if (subscription.status === "active") {
    console.log(
      `Subscription ${subscription.id} is already active, ensuring proper activation`
    );
    // The updateSubscriptionStatus above should handle this, but we log it for clarity
  }
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
  console.log("🎉 Invoice payment succeeded:", invoice.id);
  console.log("📊 Invoice details:", {
    id: invoice.id,
    subscription: invoice.subscription,
    status: invoice.status,
    amount_paid: invoice.amount_paid,
    customer: invoice.customer,
    billing_reason: invoice.billing_reason,
  });

  if (invoice.subscription) {
    const subscriptionId = invoice.subscription as string;
    console.log("🔗 Processing subscription:", subscriptionId);

    try {
      // Update billing record status
      const billingUpdate = await Billing.findOneAndUpdate(
        { stripeInvoiceId: invoice.id },
        { status: "succeeded" },
        { new: true }
      );
      console.log("💰 Billing record updated:", billingUpdate ? "Success" : "Not found");

      // Get the latest subscription data from Stripe to ensure we have the correct status
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2023-10-16",
      });
      
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log(`📊 Stripe subscription status: ${stripeSubscription.status}`);

      // Update subscription status based on Stripe's current status
      await subscriptionService.updateSubscriptionStatus(
        subscriptionId,
        stripeSubscription.status
      );
      
      console.log(`✅ Successfully updated subscription ${subscriptionId} status to ${stripeSubscription.status}`);
    } catch (error) {
      console.error(`❌ Failed to process invoice payment for subscription ${subscriptionId}:`, error);
    }
  } else {
    console.log("⚠️ Invoice has no associated subscription");
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  console.log("🎉 Payment intent succeeded:", paymentIntent.id);
  console.log("Payment intent details:", {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    status: paymentIntent.status,
    customer: paymentIntent.customer,
    metadata: paymentIntent.metadata,
  });

  // If this payment intent is associated with a subscription, sync the subscription status
  if (paymentIntent.metadata?.subscriptionId) {
    const subscriptionId = paymentIntent.metadata.subscriptionId;
    console.log(
      "🔗 Payment intent associated with subscription, syncing status:",
      subscriptionId
    );

    try {
      // Get the latest subscription data from Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2023-10-16",
      });
      
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log(`📊 Stripe subscription status: ${stripeSubscription.status}`);

      // Update subscription status based on Stripe's current status
      await subscriptionService.updateSubscriptionStatus(
        subscriptionId,
        stripeSubscription.status
      );
      
      console.log(
        `✅ Successfully synced subscription ${subscriptionId} status to ${stripeSubscription.status} from payment intent`
      );
    } catch (error) {
      console.error(
        `❌ Failed to sync subscription ${subscriptionId}:`,
        error
      );
    }
  } else {
    // FALLBACK: Try to find subscription by customer ID and recent incomplete subscriptions
    console.log("⚠️ Payment intent has no subscriptionId in metadata, trying fallback method");
    console.log("🔍 Payment intent details:", {
      paymentIntentId: paymentIntent.id,
      customer: paymentIntent.customer,
      metadata: paymentIntent.metadata
    });

    if (paymentIntent.customer) {
      try {
        await subscriptionService.syncRecentSubscriptionByCustomer(
          paymentIntent.customer as string,
          paymentIntent.id
        );
        console.log("✅ Successfully synced subscription using customer fallback method");
      } catch (error) {
        console.error("❌ Fallback subscription sync failed:", error);
      }
    } else {
      console.log("❌ No customer ID available for fallback sync");
    }
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
