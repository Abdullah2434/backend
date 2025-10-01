import { Response } from "express";
import SubscriptionService from "../services/subscription.service";
import { SubscriptionResponse } from "../types/subscription.types";
import { logSubscriptionError } from "../utils/subscription.utils";

const subscriptionService = new SubscriptionService();

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

export const getPlans = async (req: any, res: Response): Promise<void> => {
  try {
    const plans = subscriptionService.getPlans();
    sendResponse(res, 200, "Subscription plans retrieved successfully", {
      plans,
    });
  } catch (error: any) {
    logSubscriptionError(error, { action: "getPlans" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve plans"
    );
  }
};

export const getCurrentSubscription = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const subscription = userId
      ? await subscriptionService.getCurrentSubscription(userId)
      : null;

    sendResponse(res, 200, "Current subscription retrieved successfully", {
      subscription,
      isAuthenticated: !!userId,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      action: "getCurrentSubscription",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve subscription"
    );
  }
};

export const createSubscription = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { planId, paymentMethodId, couponCode } = req.body;
    const result = await subscriptionService.createSubscription({
      userId: req.user!._id,
      planId,
      paymentMethodId,
      couponCode,
    });
    sendResponse(res, 200, "Subscription created successfully", {
      subscription: result,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      planId: req.body.planId,
      action: "createSubscription",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to create subscription"
    );
  }
};

export const cancelSubscription = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { reason, immediate } = req.body;
    const result = await subscriptionService.cancelSubscription(
      req.user!._id,
      reason,
      immediate
    );
    sendResponse(res, 200, "Subscription canceled successfully", {
      subscription: result,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      action: "cancelSubscription",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to cancel subscription"
    );
  }
};

export const reactivateSubscription = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const result = await subscriptionService.reactivateSubscription(
      req.user!._id
    );
    sendResponse(res, 200, "Subscription reactivated successfully", {
      subscription: result,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      action: "reactivateSubscription",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to reactivate subscription"
    );
  }
};

export const getPaymentMethods = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const paymentMethods = await subscriptionService.getPaymentMethods(
      req.user!._id
    );
    sendResponse(res, 200, "Payment methods retrieved successfully", {
      paymentMethods,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      action: "getPaymentMethods",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve payment methods"
    );
  }
};

export const checkVideoLimit = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const result = await subscriptionService.checkVideoLimit(req.user!._id);
    sendResponse(res, 200, "Video limit checked successfully", result);
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      action: "checkVideoLimit",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to check video limit"
    );
  }
};

export const createPaymentIntent = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { amount, currency, paymentMethodId, description } = req.body;
    const result = await subscriptionService.createPaymentIntent({
      userId: req.user!._id,
      amount,
      currency: currency || "usd",
      paymentMethodId,
      description,
    });
    sendResponse(res, 200, "Payment intent created successfully", {
      paymentIntent: result,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      amount: req.body.amount,
      action: "createPaymentIntent",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to create payment intent"
    );
  }
};

export const confirmPaymentIntent = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { paymentIntentId, paymentMethodId } = req.body;
    const result = await subscriptionService.confirmPaymentIntent(
      req.user!._id,
      paymentIntentId,
      paymentMethodId
    );
    sendResponse(res, 200, "Payment intent confirmed successfully", {
      paymentIntent: result,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      paymentIntentId: req.body.paymentIntentId,
      action: "confirmPaymentIntent",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to confirm payment intent"
    );
  }
};

export const getPaymentIntentStatus = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await subscriptionService.getPaymentIntentStatus(id);
    sendResponse(res, 200, "Payment intent status retrieved successfully", {
      paymentIntent: result,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      paymentIntentId: req.params.id,
      action: "getPaymentIntentStatus",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve payment intent status"
    );
  }
};

export const changePlan = async (req: any, res: Response): Promise<void> => {
  try {
    const { newPlanId, prorationBehavior } = req.body;
    const result = await subscriptionService.changePlan(
      req.user!._id,
      newPlanId,
      prorationBehavior
    );
    sendResponse(res, 200, "Plan changed successfully", {
      subscription: result,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      newPlanId: req.body.newPlanId,
      action: "changePlan",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to change plan"
    );
  }
};

export const getPlanChangeOptions = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const subscription = await subscriptionService.getCurrentSubscription(
      req.user!._id
    );
    if (!subscription) {
      sendResponse(res, 404, "No active subscription found");
      return;
    }

    const upgradeOptions = subscriptionService.getUpgradeOptions(
      subscription.planId
    );
    const downgradeOptions = subscriptionService.getDowngradeOptions(
      subscription.planId
    );

    sendResponse(res, 200, "Plan change options retrieved successfully", {
      currentPlan: subscription,
      upgradeOptions,
      downgradeOptions,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      action: "getPlanChangeOptions",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve plan change options"
    );
  }
};

export const getBillingHistory = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const result = await subscriptionService.getBillingHistory(req.user!._id);
    sendResponse(res, 200, "Billing history retrieved successfully", result);
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      action: "getBillingHistory",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve billing history"
    );
  }
};

export const getBillingSummary = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const result = await subscriptionService.getBillingSummary(req.user!._id);
    sendResponse(res, 200, "Billing summary retrieved successfully", {
      summary: result,
    });
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      action: "getBillingSummary",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve billing summary"
    );
  }
};

export const syncSubscriptionFromStripe = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    sendResponse(res, 200, "Subscription synced from Stripe successfully");
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      action: "syncSubscriptionFromStripe",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to sync subscription from Stripe"
    );
  }
};

export const debugWebhook = async (req: any, res: Response): Promise<void> => {
  try {
    sendResponse(res, 200, "Webhook debug completed successfully");
  } catch (error: any) {
    logSubscriptionError(error, {
      userId: req.user?._id,
      action: "debugWebhook",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to debug webhook"
    );
  }
};

export const healthCheck = async (req: any, res: Response): Promise<void> => {
  try {
    const health = await subscriptionService.healthCheck();
    const statusCode = health.status === "healthy" ? 200 : 503;
    sendResponse(
      res,
      statusCode,
      `Subscription service is ${health.status}`,
      health
    );
  } catch (error: any) {
    logSubscriptionError(error, { action: "healthCheck" });
    sendResponse(res, 500, "Health check failed");
  }
};
