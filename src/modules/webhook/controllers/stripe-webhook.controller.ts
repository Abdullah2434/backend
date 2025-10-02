import Stripe from "stripe";
import { Response } from "express";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import Billing from "../../../database/models/Billing";

const subscriptionService = new SubscriptionService();

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (req: any, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"];
  // TEMPORARY: Hardcoded webhook secret for testing
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    res.status(500).json({
      success: false,
      message: "Webhook secret not configured",
    });
    return;
  }
  console.log("🔐 Using webhook secret:", webhookSecret.substring(0, 10) + "...");
  console.log("🔍 Webhook signature:", sig);
  console.log("🔍 Request body type:", typeof req.body);
  console.log("🔍 Request body constructor:", req.body?.constructor?.name);
  console.log("🔍 Request body is Buffer:", Buffer.isBuffer(req.body));
  console.log("🔍 Request body length:", req.body?.length || 0);
  console.log("🔍 Raw body content:", req.body);
  let event;
  try {
    // Verify webhook signature with raw body
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
    });
    // Get raw body - should be a Buffer from Express raw middleware
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      console.error("❌ Expected Buffer body, got:", typeof rawBody);
      res.status(400).json({
        success: false,
        message: "Invalid request body format",
      });
      return;
    }
    console.log("🔍 Raw body length:", rawBody.length);
    console.log("🔍 Body preview:", rawBody.toString("utf8").substring(0, 200) + "...");
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log("✅ Webhook signature verified successfully");
    console.log("📋 Event type:", event.type);
    console.log("📋 Event ID:", event.id);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    console.error("❌ Error details:", err);
    res.status(400).json({
      success: false,
      message: "Invalid webhook signature",
    });
    return;
  }
  // Ensure we have a valid event before processing
  if (!event) {
    console.error("❌ No valid event object found after parsing");
    res.status(400).json({
      success: false,
      message: "Failed to parse webhook event",
    });
    return;
  }
  try {
    console.log(`Processing webhook event: ${event.type}`);
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event.data.object);
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
};

/**
 * Handle checkout session completion - this is where we create subscription records
 */
async function handleCheckoutSessionCompleted(session: any) {
  console.log("🎉 Checkout session completed:", session.id);
  console.log("📊 Session details:", {
    id: session.id,
    mode: session.mode,
    payment_status: session.payment_status,
    customer: session.customer,
    subscription: session.subscription,
    metadata: session.metadata,
  });
  // Only process if payment was successful
  if (session.payment_status !== "paid") {
    console.log("⚠️ Checkout session not paid, skipping subscription creation");
    return;
  }
  // Only process subscription mode (not one-time payments)
  if (session.mode !== "subscription") {
    console.log("⚠️ Not a subscription checkout session, skipping");
    return;
  }
  if (session.subscription) {
    const subscriptionId = session.subscription;
    console.log("🔗 Processing subscription from checkout session:", subscriptionId);
    try {
      // Get the latest subscription data from Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2023-10-16",
      });
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log(`📊 Stripe subscription status: ${stripeSubscription.status}`);
      // Create or update subscription record in database
      await subscriptionService.createOrUpdateSubscriptionFromWebhook(stripeSubscription, session.metadata || {});
      console.log(`✅ Successfully created/updated subscription ${subscriptionId} from checkout session`);
    } catch (error) {
      console.error(`❌ Failed to process checkout session for subscription ${subscriptionId}:`, error);
    }
  } else {
    console.log("⚠️ Checkout session has no associated subscription");
  }
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(subscription: any) {
  console.log("Subscription created:", subscription.id);
  console.log("Subscription details:", {
    id: subscription.id,
    status: subscription.status,
    customer: subscription.customer,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
  });
  // Only update existing subscription status, don't create new ones here
  // New subscriptions should be created via checkout.session.completed or invoice.payment_succeeded
  const existingSubscription = await subscriptionService.getSubscriptionByStripeId(subscription.id);
  if (existingSubscription) {
    console.log(`📝 Updating existing subscription ${subscription.id} status to ${subscription.status}`);
    await subscriptionService.updateSubscriptionStatus(subscription.id, subscription.status);
  } else {
    console.log(`⚠️ Subscription ${subscription.id} created event received but no local record found. This should be handled by checkout.session.completed or invoice.payment_succeeded.`);
  }
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: any) {
  console.log("Subscription updated:", subscription.id);
  // Update subscription status in database
  await subscriptionService.updateSubscriptionStatus(subscription.id, subscription.status);
  // If subscription is active and it's a new billing period, reset video count
  if (subscription.status === "active") {
    await subscriptionService.resetVideoCountForNewPeriod(subscription.id);
  }
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: any) {
  console.log("Subscription deleted:", subscription.id);
  // Update subscription status in database
  await subscriptionService.updateSubscriptionStatus(subscription.id, "canceled");
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: any) {
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
    const subscriptionId = invoice.subscription;
    console.log("🔗 Processing subscription:", subscriptionId);
    try {
      // Update billing record status
      const billingUpdate = await Billing.findOneAndUpdate({ stripeInvoiceId: invoice.id }, { status: "succeeded" }, { new: true });
      console.log("💰 Billing record updated:", billingUpdate ? "Success" : "Not found");
      // Get the latest subscription data from Stripe to ensure we have the correct status
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2023-10-16",
      });
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log(`📊 Stripe subscription status: ${stripeSubscription.status}`);
      // Check if subscription record exists in database
      const existingSubscription = await subscriptionService.getSubscriptionByStripeId(subscriptionId);
      if (existingSubscription) {
        // Update existing subscription status
        await subscriptionService.updateSubscriptionStatus(subscriptionId, stripeSubscription.status);
        console.log(`✅ Successfully updated existing subscription ${subscriptionId} status to ${stripeSubscription.status}`);
      } else {
        // Create new subscription record from webhook
        await subscriptionService.createOrUpdateSubscriptionFromWebhook(stripeSubscription, {
          userId: stripeSubscription.metadata?.userId,
          planId: stripeSubscription.metadata?.planId,
        });
        console.log(`✅ Successfully created new subscription ${subscriptionId} from invoice payment webhook`);
      }
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
async function handlePaymentIntentSucceeded(paymentIntent: any) {
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
    console.log("🔗 Payment intent associated with subscription, syncing status:", subscriptionId);
    try {
      // Get the latest subscription data from Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2023-10-16",
      });
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log(`📊 Stripe subscription status: ${stripeSubscription.status}`);
      // Update subscription status based on Stripe's current status
      await subscriptionService.updateSubscriptionStatus(subscriptionId, stripeSubscription.status);
      console.log(`✅ Successfully synced subscription ${subscriptionId} status to ${stripeSubscription.status} from payment intent`);
      // Additional verification: Check if the subscription was actually updated in the database
      const updatedLocalSub = await subscriptionService.getSubscriptionByStripeId(subscriptionId);
      if (updatedLocalSub) {
        console.log(`🔍 Database verification: Local subscription status is now: ${updatedLocalSub.status}`);
      } else {
        console.log(`⚠️ Database verification: Could not find local subscription with Stripe ID: ${subscriptionId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to sync subscription ${subscriptionId}:`, error);
    }
  } else {
    // FALLBACK: Try to find subscription by customer ID and recent incomplete subscriptions
    console.log("⚠️ Payment intent has no subscriptionId in metadata, trying fallback method");
    console.log("🔍 Payment intent details:", {
      paymentIntentId: paymentIntent.id,
      customer: paymentIntent.customer,
      metadata: paymentIntent.metadata,
    });
    if (paymentIntent.customer) {
      try {
        await subscriptionService.syncRecentSubscriptionByCustomer(paymentIntent.customer, paymentIntent.id);
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
async function handleInvoicePaymentFailed(invoice: any) {
  console.log("Invoice payment failed:", invoice.id);
  if (invoice.subscription) {
    // Update billing record status
    await Billing.findOneAndUpdate({ stripeInvoiceId: invoice.id }, { status: "failed" });
    // Update subscription status to past_due
    await subscriptionService.updateSubscriptionStatus(invoice.subscription, "past_due");
  }
}

/**
 * Handle trial ending
 */
async function handleTrialWillEnd(subscription: any) {
  console.log("Trial will end for subscription:", subscription.id);
  // You can send email notifications here
  // await sendTrialEndingEmail(subscription.customer as string)
}
