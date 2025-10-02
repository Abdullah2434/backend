import { Response } from "express";
import { SubscriptionService } from "../services/subscription.service";
import { AuthService } from "../../auth/services/auth.service";
import { logSubscriptionError } from "../utils/subscription.utils";

const subscriptionService = new SubscriptionService();
const authService = new AuthService();

const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: any
): void => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data,
  });
};

function requireAuth(req: any) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) throw new Error("Access token is required");
  const payload = authService.verifyToken(token);
  if (!payload) throw new Error("Invalid or expired access token");
  return payload;
}

/**
 * Get all available subscription plans
 */
export const getPlans = async (req: any, res: Response): Promise<void> => {
  try {
    const plans = subscriptionService.getPlans();
    sendResponse(res, 200, "Subscription plans retrieved successfully", {
      plans,
    });
  } catch (error: any) {
    sendResponse(res, 500, error.message || "Internal server error");
  }
};

/**
 * Get user's current subscription
 * This endpoint works both with and without authentication
 */
export const getCurrentSubscription = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    // Try to get authentication, but don't require it
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) {
      // No token provided - return no subscription (guest user)
      sendResponse(res, 200, "No authentication provided - guest user", {
        subscription: null,
      });
      return;
    }
    // Verify token if provided
    const payload = authService.verifyToken(token);
    if (!payload) {
      // Invalid token - return no subscription
      sendResponse(res, 200, "Invalid token - guest user", {
        subscription: null,
      });
      return;
    }
    // Valid token - get user's subscription
    const subscription = await subscriptionService.getActiveSubscription(
      payload.userId
    );
    if (!subscription) {
      sendResponse(res, 200, "No active subscription found", {
        subscription: null,
      });
      return;
    }
    sendResponse(res, 200, "Subscription retrieved successfully", {
      subscription,
    });
  } catch (error: any) {
    // For any error, return as guest user instead of throwing 401
    console.warn("Error in getCurrentSubscription:", error.message);
    sendResponse(res, 200, "Error retrieving subscription - guest user", {
      subscription: null,
    });
  }
};

/**
 * Create a new subscription
 */
export const createSubscription = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    const { planId, paymentMethodId } = req.body;
    if (!planId || !paymentMethodId) {
      sendResponse(res, 400, "Plan ID and payment method ID are required");
      return;
    }
    const subscription = await subscriptionService.createSubscription({
      userId: payload.userId,
      planId,
      paymentMethodId,
    });
    sendResponse(res, 201, "Subscription created successfully", {
      subscription,
    });
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Cancel subscription at period end
 */
export const cancelSubscription = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    await subscriptionService.cancelSubscription(payload.userId);
    sendResponse(
      res,
      200,
      "Subscription will be canceled at the end of the current period"
    );
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Reactivate subscription
 */
export const reactivateSubscription = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    await subscriptionService.reactivateSubscription(payload.userId);
    sendResponse(res, 200, "Subscription reactivated successfully");
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Get user's payment methods
 */
export const getPaymentMethods = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    const paymentMethods = await subscriptionService.getPaymentMethods(
      payload.userId
    );
    sendResponse(res, 200, "Payment methods retrieved successfully", {
      paymentMethods,
    });
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Check if user can create a video
 */
export const checkVideoLimit = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    const videoLimit = await subscriptionService.canCreateVideo(payload.userId);
    sendResponse(res, 200, "Video limit check completed", videoLimit);
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Create payment intent for subscription
 */
export const createPaymentIntent = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    const { planId } = req.body;
    if (!planId) {
      sendResponse(res, 400, "Plan ID is required");
      return;
    }
    const plan = subscriptionService.getPlan(planId);
    if (!plan) {
      sendResponse(res, 400, "Invalid plan ID");
      return;
    }
    // Get user information
    const user = await authService.getCurrentUser(
      req.headers.authorization?.replace("Bearer ", "") || ""
    );
    if (!user) {
      sendResponse(res, 401, "User not found");
      return;
    }
    // Create payment intent (service handles all validation and cleanup automatically)
    const result = await subscriptionService.createPaymentIntentOriginal({
      userId: payload.userId,
      planId,
      customerEmail: user.email,
      customerName: `${user.firstName} ${user.lastName}`,
    });
    sendResponse(
      res,
      200,
      "Payment intent and subscription created successfully",
      {
        paymentIntent: result.paymentIntent,
        subscription: result.subscription,
        plan,
        amount: plan.price,
        currency: "usd",
      }
    );
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Confirm payment intent and create subscription
 */
export const confirmPaymentIntent = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    const { paymentIntentId, paymentMethodId } = req.body;
    if (!paymentIntentId || !paymentMethodId) {
      sendResponse(
        res,
        400,
        "Payment intent ID and payment method ID are required"
      );
      return;
    }
    // Confirm payment intent and create subscription
    const subscription =
      await subscriptionService.confirmPaymentIntentAndCreateSubscription(
        paymentIntentId,
        paymentMethodId
      );
    sendResponse(
      res,
      201,
      "Payment confirmed and subscription created successfully",
      {
        subscription,
      }
    );
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Get payment intent status
 */
export const getPaymentIntentStatus = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    const { id } = req.params;
    if (!id) {
      sendResponse(res, 400, "Payment intent ID is required");
      return;
    }
    // Get payment intent status from Stripe
    const paymentIntent = await subscriptionService.getPaymentIntentStatus(id);
    sendResponse(res, 200, "Payment intent status retrieved successfully", {
      paymentIntent,
    });
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Change subscription plan (upgrade/downgrade)
 */
export const changePlan = async (req: any, res: Response): Promise<void> => {
  try {
    const payload = requireAuth(req);
    const { newPlanId } = req.body;
    if (!newPlanId) {
      sendResponse(res, 400, "New plan ID is required");
      return;
    }
    // Change the plan
    const subscription = await subscriptionService.changePlan(
      payload.userId,
      newPlanId
    );
    sendResponse(res, 200, "Plan changed successfully", {
      subscription,
    });
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Get plan change options (upgrades/downgrades)
 */
export const getPlanChangeOptions = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    // Get current subscription to determine current plan
    const currentSubscription = await subscriptionService.getActiveSubscription(
      payload.userId
    );
    if (!currentSubscription) {
      sendResponse(res, 400, "No active subscription found");
      return;
    }
    // Get upgrade/downgrade options
    const options = subscriptionService.getPlanChangeOptions(
      currentSubscription.planId
    );
    sendResponse(
      res,
      200,
      "Plan change options retrieved successfully",
      options
    );
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Get user's billing history (transaction history)
 */
export const getBillingHistory = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    const { limit = 20, offset = 0, status, startDate, endDate } = req.query;
    // Parse query parameters
    const options: any = {
      limit: parseInt(limit as string) || 20,
      offset: parseInt(offset as string) || 0,
    };
    if (status) options.status = status;
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    // Validate limit
    if (options.limit > 100) {
      options.limit = 100; // Max 100 records per request
    }
    const result = await subscriptionService.getBillingHistory(payload.userId);
    sendResponse(res, 200, "Billing history retrieved successfully", result);
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Get user's billing summary
 */
export const getBillingSummary = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    const summary = await subscriptionService.getBillingSummary(payload.userId);
    sendResponse(res, 200, "Billing summary retrieved successfully", summary);
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Sync subscription status from Stripe (for webhook failures)
 */
export const syncSubscriptionFromStripe = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const payload = requireAuth(req);
    const { stripeSubscriptionId } = req.body;
    if (!stripeSubscriptionId) {
      sendResponse(res, 400, "Stripe subscription ID is required");
      return;
    }
    await subscriptionService.syncSubscriptionFromStripe(stripeSubscriptionId);
    sendResponse(
      res,
      200,
      "Subscription status synced successfully from Stripe"
    );
  } catch (error: any) {
    const status = error.message.includes("Access token") ? 401 : 500;
    sendResponse(res, status, error.message || "Internal server error");
  }
};

/**
 * Debug endpoint to check webhook processing
 */
export const debugWebhook = async (req: any, res: Response): Promise<void> => {
  try {
    const { paymentIntentId, subscriptionId } = req.body;
    if (!paymentIntentId && !subscriptionId) {
      sendResponse(
        res,
        400,
        "Either paymentIntentId or subscriptionId is required"
      );
      return;
    }
    const Stripe = require("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });
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
    sendResponse(res, 200, "Debug information retrieved", debugInfo);
  } catch (error: any) {
    sendResponse(res, 500, error.message || "Internal server error");
  }
};

/**
 * Health check endpoint
 */
export const healthCheck = async (req: any, res: Response): Promise<void> => {
  try {
    const health = await subscriptionService.getHealthStatus();
    const statusCode = health.status === "healthy" ? 200 : 503;
    sendResponse(
      res,
      statusCode,
      `Subscription service is ${health.status}`,
      health
    );
  } catch (error: any) {
    sendResponse(res, 503, "Health check failed", {
      status: "unhealthy",
      error: error.message,
    });
  }
};
