import { Request, Response } from "express";
import AuthService from "../services/auth.service";
import { SubscriptionService } from "../services/subscription.service";
import { ApiResponse } from "../types";

const authService = new AuthService();
const subscriptionService = new SubscriptionService();

function requireAuth(req: Request) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) throw new Error("Access token is required");
  const payload = authService.verifyToken(token);
  if (!payload) throw new Error("Invalid or expired access token");
  return payload;
}

/**
 * Get all available subscription plans
 */
export async function getPlans(req: Request, res: Response) {
  try {
    const plans = subscriptionService.getPlans();

    return res.json({
      success: true,
      message: "Subscription plans retrieved successfully",
      data: { plans },
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Get user's current subscription
 * This endpoint works both with and without authentication
 */
export async function getCurrentSubscription(req: Request, res: Response) {
  try {
    // Try to get authentication, but don't require it
    const token = (req.headers.authorization || "").replace("Bearer ", "");

    if (!token) {
      // No token provided - return no subscription (guest user)
      return res.json({
        success: true,
        message: "No authentication provided - guest user",
        data: { subscription: null },
      });
    }

    // Verify token if provided
    const payload = authService.verifyToken(token);
    if (!payload) {
      // Invalid token - return no subscription
      return res.json({
        success: true,
        message: "Invalid token - guest user",
        data: { subscription: null },
      });
    }

    // Valid token - get user's subscription
    const subscription = await subscriptionService.getActiveSubscription(
      payload.userId
    );

    if (!subscription) {
      return res.json({
        success: true,
        message: "No active subscription found",
        data: { subscription: null },
      });
    }

    return res.json({
      success: true,
      message: "Subscription retrieved successfully",
      data: { subscription },
    });
  } catch (e: any) {
    // For any error, return as guest user instead of throwing 401
    console.warn("Error in getCurrentSubscription:", e.message);
    return res.json({
      success: true,
      message: "Error retrieving subscription - guest user",
      data: { subscription: null },
    });
  }
}

/**
 * Create a new subscription
 */
export async function createSubscription(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { planId, paymentMethodId } = req.body;

    if (!planId || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID and payment method ID are required",
      });
    }

    const subscription = await subscriptionService.createSubscription({
      userId: payload.userId,
      planId,
      paymentMethodId,
    });

    return res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      data: { subscription },
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);

    await subscriptionService.cancelSubscription(payload.userId);

    return res.json({
      success: true,
      message: "Subscription will be canceled at the end of the current period",
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Reactivate subscription
 */
export async function reactivateSubscription(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);

    await subscriptionService.reactivateSubscription(payload.userId);

    return res.json({
      success: true,
      message: "Subscription reactivated successfully",
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Get user's payment methods
 */
export async function getPaymentMethods(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const paymentMethods = await subscriptionService.getPaymentMethods(
      payload.userId
    );

    return res.json({
      success: true,
      message: "Payment methods retrieved successfully",
      data: { paymentMethods },
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Check if user can create a video
 */
export async function checkVideoLimit(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const videoLimit = await subscriptionService.canCreateVideo(payload.userId);

    return res.json({
      success: true,
      message: "Video limit check completed",
      data: videoLimit,
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Create payment intent for subscription
 */
export async function createPaymentIntent(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { planId } = req.body;

    console.log(
      `📝 Creating payment intent for user ${payload.userId}, plan ${planId}`
    );

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID is required",
      });
    }

    const plan = subscriptionService.getPlan(planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    // Get user information
    const user = await authService.getCurrentUser(
      req.headers.authorization?.replace("Bearer ", "") || ""
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check for existing incomplete payment intents for this user and plan
    const existingSubs =
      await subscriptionService.hasExistingSubscriptionForPlan(
        payload.userId,
        planId
      );

    if (existingSubs.hasPending || existingSubs.hasIncomplete) {
      console.log(
        `⚠️ User ${payload.userId} already has pending/incomplete subscription for plan ${planId}`
      );
      console.log(
        `⚠️ Cleaning up incomplete subscriptions before creating new one`
      );
    }

    // Create payment intent (service handles all validation and cleanup automatically)
    const result = await subscriptionService.createPaymentIntent({
      userId: payload.userId,
      planId,
      customerEmail: user.email,
      customerName: `${user.firstName} ${user.lastName}`,
    });

    console.log(
      `✅ Payment intent created: ${result.paymentIntent.id}, subscription: ${result.subscription.stripeSubscriptionId}`
    );

    return res.json({
      success: true,
      message: "Payment intent and subscription created successfully",
      data: {
        paymentIntent: result.paymentIntent,
        subscription: result.subscription,
        plan,
        amount: plan.price,
        currency: "usd",
      },
    });
  } catch (e: any) {
    console.error(`❌ Error creating payment intent:`, e.message);
    console.error(`❌ Stack:`, e.stack);
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Confirm payment intent and create subscription
 */
export async function confirmPaymentIntent(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { paymentIntentId, paymentMethodId } = req.body;

    if (!paymentIntentId || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment intent ID and payment method ID are required",
      });
    }

    // Confirm payment intent and create subscription
    const subscription =
      await subscriptionService.confirmPaymentIntentAndCreateSubscription(
        paymentIntentId,
        paymentMethodId
      );

    return res.status(201).json({
      success: true,
      message: "Payment confirmed and subscription created successfully",
      data: { subscription },
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Get payment intent status and auto-sync if payment succeeded
 */
export async function getPaymentIntentStatus(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { id } = req.params;
    const { autoSync } = req.query; // Optional: autoSync=true to automatically sync on success

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment intent ID is required",
      });
    }

    // Get payment intent status from Stripe
    const paymentIntent = await subscriptionService.getPaymentIntentStatus(id);

    // If payment succeeded and autoSync is enabled, automatically sync subscription
    if (paymentIntent.status === "succeeded" && autoSync === "true") {
      console.log(
        `🔄 Payment succeeded, auto-syncing subscription for payment intent ${id}`
      );
      try {
        const subscription =
          await subscriptionService.syncSubscriptionFromStripe(
            id, // payment intent ID
            payload.userId
          );

        return res.json({
          success: true,
          message:
            "Payment intent status retrieved and subscription synced successfully",
          data: {
            paymentIntent,
            subscription, // Auto-synced subscription
            autoSynced: true,
          },
        });
      } catch (syncError: any) {
        console.error(`⚠️ Auto-sync failed:`, syncError.message);
        // Still return payment intent status even if sync fails
      }
    }

    return res.json({
      success: true,
      message: "Payment intent status retrieved successfully",
      data: {
        paymentIntent,
        autoSynced: false,
      },
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Change subscription plan (upgrade/downgrade)
 */
export async function changePlan(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { newPlanId } = req.body;

    if (!newPlanId) {
      return res.status(400).json({
        success: false,
        message: "New plan ID is required",
      });
    }

    // Change the plan
    const subscription = await subscriptionService.changePlan(
      payload.userId,
      newPlanId
    );

    return res.json({
      success: true,
      message: "Plan changed successfully",
      data: { subscription },
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Get plan change options (upgrades/downgrades)
 */
export async function getPlanChangeOptions(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);

    // Get current subscription to determine current plan
    const currentSubscription = await subscriptionService.getActiveSubscription(
      payload.userId
    );

    if (!currentSubscription) {
      return res.status(400).json({
        success: false,
        message: "No active subscription found",
      });
    }

    // Get upgrade/downgrade options
    const options = subscriptionService.getPlanChangeOptions(
      currentSubscription.planId
    );

    return res.json({
      success: true,
      message: "Plan change options retrieved successfully",
      data: options,
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Get user's billing history (transaction history)
 */
export async function getBillingHistory(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { limit = 20, offset = 0, status, startDate, endDate } = req.query;

    // Parse query parameters
    const options: any = {
      limit: parseInt(limit as string) || 20,
      offset: parseInt(offset as string) || 0,
    };

    if (status) options.status = status as string;
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);

    // Validate limit
    if (options.limit > 100) {
      options.limit = 100; // Max 100 records per request
    }

    const result = await subscriptionService.getBillingHistory(
      payload.userId,
      options
    );

    return res.json({
      success: true,
      message: "Billing history retrieved successfully",
      data: result,
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Get user's billing summary
 */
export async function getBillingSummary(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);

    const summary = await subscriptionService.getBillingSummary(payload.userId);

    return res.json({
      success: true,
      message: "Billing summary retrieved successfully",
      data: summary,
    });
  } catch (e: any) {
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Sync subscription from Stripe (manual sync after payment)
 * This creates or updates the subscription record in the database
 * Accepts either stripeSubscriptionId or paymentIntentId
 */
export async function syncSubscriptionFromStripe(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { stripeSubscriptionId, paymentIntentId } = req.body;

    if (!stripeSubscriptionId && !paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "Either stripeSubscriptionId or paymentIntentId is required",
      });
    }

    // Use payment intent ID if provided, otherwise use subscription ID
    const identifier = paymentIntentId || stripeSubscriptionId;

    console.log(
      `📞 Manual sync requested for ${
        paymentIntentId ? "payment intent" : "subscription"
      } ${identifier} by user ${payload.userId}`
    );

    // Sync subscription (creates if doesn't exist, updates if exists)
    // The service will automatically detect if it's a payment intent ID or subscription ID
    const subscription = await subscriptionService.syncSubscriptionFromStripe(
      identifier,
      payload.userId
    );

    return res.json({
      success: true,
      message: "Subscription synced successfully from Stripe",
      data: {
        subscription,
      },
    });
  } catch (e: any) {
    console.error(`❌ Error in syncSubscriptionFromStripe:`, e.message);
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * Auto-sync subscription when payment succeeds
 * This endpoint automatically syncs subscription when called with a succeeded payment intent
 */
export async function autoSyncOnPaymentSuccess(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "Payment intent ID is required",
      });
    }

    console.log(
      `🔄 Auto-sync requested for payment intent ${paymentIntentId} by user ${payload.userId}`
    );

    // Check payment intent status first
    const paymentIntent = await subscriptionService.getPaymentIntentStatus(
      paymentIntentId
    );

    console.log(
      `📊 Payment intent status: ${paymentIntent.status}, metadata:`,
      paymentIntent.metadata
    );

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        success: false,
        message: `Payment intent status is ${paymentIntent.status}, not succeeded. Cannot sync subscription.`,
        data: {
          paymentIntent: {
            id: paymentIntent.id,
            status: paymentIntent.status,
            metadata: paymentIntent.metadata,
          },
        },
      });
    }

    console.log(
      `✅ Payment intent succeeded, attempting to sync subscription...`
    );

    // Automatically sync subscription
    const subscription = await subscriptionService.syncSubscriptionFromStripe(
      paymentIntentId,
      payload.userId
    );

    console.log(
      `✅ Subscription automatically synced: ${subscription.stripeSubscriptionId}`
    );

    return res.json({
      success: true,
      message: "Payment succeeded and subscription synced successfully",
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
        },
        subscription,
      },
    });
  } catch (e: any) {
    console.error(`❌ Error in autoSyncOnPaymentSuccess:`, e);
    console.error(`Error message:`, e.message);
    console.error(`Error stack:`, e.stack);

    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
      error: process.env.NODE_ENV === "development" ? e.stack : undefined,
    });
  }
}

/**
 * Debug endpoint to check webhook processing
 */
export async function debugWebhook(req: Request, res: Response) {
  try {
    const { paymentIntentId, subscriptionId } = req.body;

    if (!paymentIntentId && !subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "Either paymentIntentId or subscriptionId is required",
      });
    }

    const stripe = new (await import("stripe")).default(
      process.env.STRIPE_SECRET_KEY!,
      {
        apiVersion: "2023-10-16",
      }
    );

    let debugInfo: any = {};

    if (paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );
      debugInfo.paymentIntent = {
        id: paymentIntent.id,
        status: paymentIntent.status,
        metadata: paymentIntent.metadata,
        amount: paymentIntent.amount,
      };
    }

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      debugInfo.subscription = {
        id: subscription.id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
      };
    }

    return res.json({
      success: true,
      message: "Debug information retrieved",
      data: debugInfo,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}
