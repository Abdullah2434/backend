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
 */
export async function getCurrentSubscription(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
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
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
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

    // Create payment intent (service handles all validation and cleanup automatically)
    const result = await subscriptionService.createPaymentIntent({
      userId: payload.userId,
      planId,
      customerEmail: user.email,
      customerName: `${user.firstName} ${user.lastName}`,
    });

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
 * Get payment intent status
 */
export async function getPaymentIntentStatus(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment intent ID is required",
      });
    }

    // Get payment intent status from Stripe
    const paymentIntent = await subscriptionService.getPaymentIntentStatus(id);

    return res.json({
      success: true,
      message: "Payment intent status retrieved successfully",
      data: { paymentIntent },
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
