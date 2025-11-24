import { Request, Response } from "express";
import AuthService from "../services/auth.service";
import { SubscriptionService } from "../services/subscription.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateCreateSubscription,
  validateCreatePaymentIntent,
  validateConfirmPaymentIntent,
  validatePaymentIntentIdParam,
  validateGetPaymentIntentStatusQuery,
  validateChangePlan,
  validateGetBillingHistoryQuery,
  validateSyncSubscriptionFromStripe,
  validateAutoSyncOnPaymentSuccess,
  validateDebugWebhook,
} from "../validations/subscription.validations";
import {
  requireAuth,
  extractToken,
  getErrorStatus,
  prepareBillingHistoryOptions,
  getSyncIdentifier,
} from "../utils/subscriptionHelpers";
import { DEFAULT_CURRENCY, STRIPE_API_VERSION } from "../constants/subscription.constants";

// ==================== SERVICE INSTANCES ====================
const authService = new AuthService();
const subscriptionService = new SubscriptionService();

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Get all available subscription plans
 */
export async function getPlans(req: Request, res: Response) {
  try {
    const plans = subscriptionService.getPlans();

    return ResponseHelper.success(
      res,
      "Subscription plans retrieved successfully",
      { plans }
    );
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
    const token = extractToken(req);

    if (!token) {
      // No token provided - return no subscription (guest user)
      return ResponseHelper.success(
        res,
        "No authentication provided - guest user",
        { subscription: null }
      );
    }

    // Verify token if provided
    const payload = authService.verifyToken(token);
    if (!payload) {
      // Invalid token - return no subscription
      return ResponseHelper.success(res, "Invalid token - guest user", {
        subscription: null,
      });
    }

    // Valid token - get user's subscription
    const subscription = await subscriptionService.getActiveSubscription(
      payload.userId
    );

    if (!subscription) {
      return ResponseHelper.success(res, "No active subscription found", {
        subscription: null,
      });
    }

    return ResponseHelper.success(res, "Subscription retrieved successfully", {
      subscription,
    });
  } catch (e: any) {
    return ResponseHelper.success(
      res,
      "Error retrieving subscription - guest user",
      { subscription: null }
    );
  }
}

/**
 * Create a new subscription
 */
export async function createSubscription(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);

    // Validate request body
    const validationResult = validateCreateSubscription(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { planId, paymentMethodId } = validationResult.data!;

    const subscription = await subscriptionService.createSubscription({
      userId: payload.userId,
      planId,
      paymentMethodId,
    });

    return ResponseHelper.created(res, "Subscription created successfully", {
      subscription,
    });
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    return ResponseHelper.success(
      res,
      "Subscription will be canceled at the end of the current period"
    );
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    return ResponseHelper.success(res, "Subscription reactivated successfully");
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    return ResponseHelper.success(
      res,
      "Payment methods retrieved successfully",
      { paymentMethods }
    );
  } catch (e: any) {
    const status = getErrorStatus(e);
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
    const videoLimit = await subscriptionService.canCreateVideo(
      payload.userId
    );

    return ResponseHelper.success(res, "Video limit check completed", videoLimit);
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    // Validate request body
    const validationResult = validateCreatePaymentIntent(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { planId } = validationResult.data!;

    const plan = subscriptionService.getPlan(planId);
    if (!plan) {
      return ResponseHelper.badRequest(res, "Invalid plan ID");
    }

    // Get user information
    const user = await authService.getCurrentUser(extractToken(req));

    if (!user) {
      return ResponseHelper.unauthorized(res, "User not found");
    }

    // Check for existing incomplete payment intents for this user and plan
    const existingSubs =
      await subscriptionService.hasExistingSubscriptionForPlan(
        payload.userId,
        planId
      );

    if (existingSubs.hasPending || existingSubs.hasIncomplete) {
      return ResponseHelper.badRequest(
        res,
        "You already have a pending or incomplete subscription for this plan",
        existingSubs
      );
    }

    // Create payment intent (service handles all validation and cleanup automatically)
    const result = await subscriptionService.createPaymentIntent({
      userId: payload.userId,
      planId,
      customerEmail: user.email,
      customerName: `${user.firstName} ${user.lastName}`,
    });

    return ResponseHelper.success(
      res,
      "Payment intent and subscription created successfully",
      {
        paymentIntent: result.paymentIntent,
        subscription: result.subscription,
        plan,
        amount: plan.price,
        currency: DEFAULT_CURRENCY,
      }
    );
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    // Validate request body
    const validationResult = validateConfirmPaymentIntent(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { paymentIntentId, paymentMethodId } = validationResult.data!;

    // Confirm payment intent and create subscription
    const subscription =
      await subscriptionService.confirmPaymentIntentAndCreateSubscription(
        paymentIntentId,
        paymentMethodId
      );

    return ResponseHelper.created(
      res,
      "Payment confirmed and subscription created successfully",
      { subscription }
    );
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    // Validate route parameter
    const paramValidation = validatePaymentIntentIdParam(req.params);
    if (!paramValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        paramValidation.errors
      );
    }

    // Validate query parameters
    const queryValidation = validateGetPaymentIntentStatusQuery(req.query);
    if (!queryValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        queryValidation.errors
      );
    }

    const { id } = paramValidation.data!;
    const { autoSync } = queryValidation.data!;

    // Get payment intent status from Stripe
    const paymentIntent = await subscriptionService.getPaymentIntentStatus(id);

    // If payment succeeded and autoSync is enabled, automatically sync subscription
    if (paymentIntent.status === "succeeded" && autoSync === "true") {
      try {
        const subscription =
          await subscriptionService.syncSubscriptionFromStripe(
            id, // payment intent ID
            payload.userId
          );

        return ResponseHelper.success(
          res,
          "Payment intent status retrieved and subscription synced successfully",
          {
            paymentIntent,
            subscription, // Auto-synced subscription
            autoSynced: true,
          }
        );
      } catch (syncError: any) {
        console.error("Failed to auto-sync subscription:", syncError);
        // Still return payment intent status even if sync fails
      }
    }

    return ResponseHelper.success(
      res,
      "Payment intent status retrieved successfully",
      {
        paymentIntent,
        autoSynced: false,
      }
    );
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    // Validate request body
    const validationResult = validateChangePlan(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { newPlanId } = validationResult.data!;

    // Change the plan
    const subscription = await subscriptionService.changePlan(
      payload.userId,
      newPlanId
    );

    return ResponseHelper.success(res, "Plan changed successfully", {
      subscription,
    });
  } catch (e: any) {
    const status = getErrorStatus(e);
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
      return ResponseHelper.badRequest(res, "No active subscription found");
    }

    // Get upgrade/downgrade options
    const options = subscriptionService.getPlanChangeOptions(
      currentSubscription.planId
    );

    return ResponseHelper.success(
      res,
      "Plan change options retrieved successfully",
      options
    );
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    // Validate query parameters
    const validationResult = validateGetBillingHistoryQuery(req.query);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const options = prepareBillingHistoryOptions(validationResult.data!);

    const result = await subscriptionService.getBillingHistory(
      payload.userId,
      options
    );

    return ResponseHelper.success(
      res,
      "Billing history retrieved successfully",
      result
    );
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    return ResponseHelper.success(
      res,
      "Billing summary retrieved successfully",
      summary
    );
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    // Validate request body
    const validationResult = validateSyncSubscriptionFromStripe(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { stripeSubscriptionId, paymentIntentId } = validationResult.data!;

    // Use payment intent ID if provided, otherwise use subscription ID
    const identifier = getSyncIdentifier(paymentIntentId, stripeSubscriptionId);

    // Sync subscription (creates if doesn't exist, updates if exists)
    // The service will automatically detect if it's a payment intent ID or subscription ID
    const subscription = await subscriptionService.syncSubscriptionFromStripe(
      identifier,
      payload.userId
    );

    return ResponseHelper.success(
      res,
      "Subscription synced successfully from Stripe",
      {
        subscription,
      }
    );
  } catch (e: any) {
    const status = getErrorStatus(e);
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

    // Validate request body
    const validationResult = validateAutoSyncOnPaymentSuccess(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { paymentIntentId } = validationResult.data!;

    // Check payment intent status first
    const paymentIntent = await subscriptionService.getPaymentIntentStatus(
      paymentIntentId
    );

    if (paymentIntent.status !== "succeeded") {
      return ResponseHelper.badRequest(
        res,
        `Payment intent status is ${paymentIntent.status}, not succeeded. Cannot sync subscription.`,
        {
          paymentIntent: {
            id: paymentIntent.id,
            status: paymentIntent.status,
            metadata: paymentIntent.metadata,
          },
        }
      );
    }

    // Automatically sync subscription
    const subscription = await subscriptionService.syncSubscriptionFromStripe(
      paymentIntentId,
      payload.userId
    );

    return ResponseHelper.success(
      res,
      "Payment succeeded and subscription synced successfully",
      {
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
        },
        subscription,
      }
    );
  } catch (e: any) {
    const status = getErrorStatus(e);
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
    // Validate request body
    const validationResult = validateDebugWebhook(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { paymentIntentId, subscriptionId } = validationResult.data!;

    const stripe = new (await import("stripe")).default(
      process.env.STRIPE_SECRET_KEY!,
      {
        apiVersion: STRIPE_API_VERSION,
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

    return ResponseHelper.success(res, "Debug information retrieved", debugInfo);
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}
