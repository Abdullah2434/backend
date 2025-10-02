import { Request, Response } from "express";
import { paymentService } from "../services/payment.service";
import { tokenService } from "../../auth/services/token.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";
import { logger } from "../../../core/utils/logger";

/**
 * Get user's payment methods
 */
export const getPaymentMethods = asyncHandler(
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

    const paymentMethods = await paymentService.getPaymentMethods(
      payload.userId
    );

    return ResponseHelper.success(
      res,
      "Payment methods retrieved successfully",
      { paymentMethods }
    );
  }
);

/**
 * Add a payment method
 */
export const addPaymentMethod = asyncHandler(
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

    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return ResponseHelper.badRequest(res, "Payment method ID is required");
    }

    const paymentMethod = await paymentService.addPaymentMethod(
      payload.userId,
      paymentMethodId
    );

    return ResponseHelper.created(
      res,
      "Payment method added successfully",
      paymentMethod
    );
  }
);

/**
 * Set default payment method
 */
export const setDefaultPaymentMethod = asyncHandler(
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

    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return ResponseHelper.badRequest(res, "Payment method ID is required");
    }

    await paymentService.setDefaultPaymentMethod(
      payload.userId,
      paymentMethodId
    );

    return ResponseHelper.success(
      res,
      "Default payment method set successfully"
    );
  }
);

/**
 * Remove a payment method
 */
export const removePaymentMethod = asyncHandler(
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

    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return ResponseHelper.badRequest(res, "Payment method ID is required");
    }

    await paymentService.removePaymentMethod(payload.userId, paymentMethodId);

    return ResponseHelper.success(res, "Payment method removed successfully");
  }
);

/**
 * Create payment intent
 */
export const createPaymentIntent = asyncHandler(
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

    const { planId, amount, currency } = req.body;

    // If planId is provided, create subscription with Stripe
    if (planId) {
      const { subscriptionService } = await import(
        "../services/subscription.service"
      );
      const { stripeService } = await import("../services/stripe.service");
      const User = (await import("../../../models/User")).default;
      const Subscription = (await import("../../../models/Subscription"))
        .default;

      const plan = subscriptionService.getPlan(planId);
      if (!plan) {
        return ResponseHelper.badRequest(res, "Invalid plan ID");
      }

      // Get user
      const user = await User.findById(payload.userId);
      if (!user) {
        return ResponseHelper.notFound(res, "User not found");
      }

      // Create or get Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripeService.createCustomer(user.email, {
          userId: user._id.toString(),
        });
        stripeCustomerId = customer.id;
        user.stripeCustomerId = stripeCustomerId;
        await user.save();
      }

      // Check if user already has an active subscription
      const existingSubscription = await Subscription.findOne({
        userId: user._id,
        status: { $in: ["active", "pending"] },
      });

      if (existingSubscription) {
        return ResponseHelper.badRequest(
          res,
          "You already have an active subscription. Please cancel it before creating a new one."
        );
      }

      // Create Stripe subscription
      const stripeSubscription = await stripeService.createSubscription(
        stripeCustomerId,
        plan.stripePriceId,
        {
          userId: user._id.toString(),
          planId: plan.id,
        }
      );

      logger.info(`Stripe subscription created: ${stripeSubscription.id}`);

      // Create subscription in database
      const subscription = new Subscription({
        userId: user._id,
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId,
        status: "pending",
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        videoCount: 0,
        videoLimit: plan.videoLimit,
      });

      try {
        await subscription.save();
        logger.info(
          `Subscription saved to database: ${subscription._id} for user ${user._id}`
        );
      } catch (saveError: any) {
        logger.error(
          `Failed to save subscription to database: ${saveError.message}`,
          saveError
        );
        // Cancel the Stripe subscription if DB save fails
        await stripeService.cancelSubscription(stripeSubscription.id, false);
        throw new Error(`Failed to create subscription: ${saveError.message}`);
      }

      // Get payment intent from subscription
      const invoice: any = stripeSubscription.latest_invoice;
      const paymentIntent = invoice?.payment_intent;

      return ResponseHelper.success(
        res,
        "Payment intent and subscription created successfully",
        {
          paymentIntent,
          subscription: subscription.toObject(),
          plan,
          amount: plan.price,
          currency: "usd",
        }
      );
    }

    // Fallback: Create standalone payment intent
    if (!amount) {
      return ResponseHelper.badRequest(
        res,
        "Either planId or amount is required"
      );
    }

    const paymentIntent = await paymentService.createPaymentIntent({
      userId: payload.userId,
      amount,
      currency: currency || "usd",
      metadata: {},
    });

    return ResponseHelper.success(
      res,
      "Payment intent created successfully",
      paymentIntent
    );
  }
);
