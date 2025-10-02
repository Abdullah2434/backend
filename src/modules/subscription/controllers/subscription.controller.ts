import { Request, Response } from "express";
import { subscriptionService } from "../services/subscription.service";
import { tokenService } from "../../auth/services/token.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Get all available subscription plans
 */
export const getPlans = asyncHandler(async (req: Request, res: Response) => {
  const plans = subscriptionService.getPlans();
  return ResponseHelper.success(
    res,
    "Subscription plans retrieved successfully",
    { plans }
  );
});

/**
 * Get current subscription
 */
export const getCurrentSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.json({
        success: true,
        message: "No authentication provided - guest user",
        data: { subscription: null },
      });
    }

    // Verify token if provided
    const payload = tokenService.verifyToken(token);
    if (!payload) {
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

    // Get plan details
    const plan = subscriptionService.getPlan(subscription.planId);

    return res.json({
      success: true,
      message: "Subscription retrieved successfully",
      data: { subscription, plan },
    });
  }
);

/**
 * Create a new subscription
 */
export const createSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return ResponseHelper.unauthorized(res, "Access token is required");
    }

    const payload = tokenService.verifyToken(token);
    if (!payload) {
      return ResponseHelper.unauthorized(
        res,
        "Invalid or expired access token"
      );
    }

    const { planId, paymentMethodId } = req.body;

    if (!planId || !paymentMethodId) {
      return ResponseHelper.badRequest(
        res,
        "Plan ID and payment method ID are required"
      );
    }

    const subscription = await subscriptionService.createSubscription({
      userId: payload.userId,
      planId,
      paymentMethodId,
    });

    return ResponseHelper.created(
      res,
      "Subscription created successfully",
      subscription
    );
  }
);

/**
 * Update subscription
 */
export const updateSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return ResponseHelper.unauthorized(res, "Access token is required");
    }

    const payload = tokenService.verifyToken(token);
    if (!payload) {
      return ResponseHelper.unauthorized(
        res,
        "Invalid or expired access token"
      );
    }

    const { subscriptionId, planId, cancelAtPeriodEnd } = req.body;

    if (!subscriptionId) {
      return ResponseHelper.badRequest(res, "Subscription ID is required");
    }

    const subscription = await subscriptionService.updateSubscription({
      subscriptionId,
      planId,
      cancelAtPeriodEnd,
    });

    return ResponseHelper.success(
      res,
      "Subscription updated successfully",
      subscription
    );
  }
);

/**
 * Cancel subscription
 */
export const cancelSubscription = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return ResponseHelper.unauthorized(res, "Access token is required");
    }

    const payload = tokenService.verifyToken(token);
    if (!payload) {
      return ResponseHelper.unauthorized(
        res,
        "Invalid or expired access token"
      );
    }

    const { subscriptionId, cancelAtPeriodEnd = true } = req.body;

    if (!subscriptionId) {
      return ResponseHelper.badRequest(res, "Subscription ID is required");
    }

    const subscription = await subscriptionService.cancelSubscription(
      subscriptionId,
      cancelAtPeriodEnd
    );

    return ResponseHelper.success(
      res,
      "Subscription canceled successfully",
      subscription
    );
  }
);

/**
 * Get subscription usage
 */
export const getUsage = asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return ResponseHelper.unauthorized(res, "Access token is required");
  }

  const payload = tokenService.verifyToken(token);
  if (!payload) {
    return ResponseHelper.unauthorized(res, "Invalid or expired access token");
  }

  const usage = await subscriptionService.getSubscriptionUsage(payload.userId);

  if (!usage) {
    return ResponseHelper.success(res, "No active subscription found", {
      usage: null,
    });
  }

  return ResponseHelper.success(res, "Usage retrieved successfully", usage);
});

/**
 * Sync subscription from Stripe
 */
export const syncFromStripe = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return ResponseHelper.unauthorized(res, "Access token is required");
    }

    const payload = tokenService.verifyToken(token);
    if (!payload) {
      return ResponseHelper.unauthorized(
        res,
        "Invalid or expired access token"
      );
    }

    const subscription = await subscriptionService.syncFromStripe(
      payload.userId
    );

    if (!subscription) {
      return ResponseHelper.notFound(res, "No subscription found to sync");
    }

    return ResponseHelper.success(
      res,
      "Subscription synced from Stripe successfully",
      subscription
    );
  }
);
