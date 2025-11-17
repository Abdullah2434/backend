import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types";
import { PaymentMethodsService } from "../services/payment-methods.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  updatePaymentMethodSchema,
  setDefaultPaymentMethodSchema,
  removePaymentMethodSchema,
} from "../validations/paymentMethods.validations";

// ==================== SERVICE INSTANCE ====================
const paymentMethodsService = new PaymentMethodsService();

// ==================== HELPER FUNCTIONS ====================
/**
 * Get user ID from authenticated request
 */
function getUserIdFromRequest(req: AuthenticatedRequest): string {
  if (!req.user?._id) {
    throw new Error("User not authenticated");
  }
  return req.user._id;
}

/**
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("access token") ||
    message.includes("not authenticated")
  ) {
    return 401;
  }
  if (
    message.includes("does not belong") ||
    message.includes("access denied")
  ) {
    return 403;
  }
  if (
    message.includes("not succeeded") ||
    message.includes("canceled subscription") ||
    message.includes("cannot remove") ||
    message.includes("required")
  ) {
    return 400;
  }
  return 500;
}

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * GET /api/payment-methods
 * Fetch all saved payment methods for the logged-in user
 */
export async function getPaymentMethods(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);

    const paymentMethods = await paymentMethodsService.getPaymentMethods(
      userId
    );

    return ResponseHelper.success(
      res,
      "Payment methods retrieved successfully",
      {
        paymentMethods,
        count: paymentMethods.length,
      }
    );
  } catch (error: any) {
    console.error("Error in getPaymentMethods:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/payment-methods/setup-intent
 * Create a SetupIntent for collecting new payment method
 */
export async function createSetupIntent(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);

    const setupIntentData = await paymentMethodsService.createSetupIntent(
      userId
    );

    return ResponseHelper.success(
      res,
      "Setup intent created successfully",
      setupIntentData
    );
  } catch (error: any) {
    console.error("Error in createSetupIntent:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/payment-methods/update
 * Confirm SetupIntent and attach payment method to customer
 */
export async function updatePaymentMethod(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);

    // Validate request body
    const validationResult = updatePaymentMethodSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { setupIntentId, setAsDefault } = validationResult.data;

    const cardInfo = await paymentMethodsService.confirmSetupIntent(
      userId,
      setupIntentId,
      setAsDefault
    );

    return ResponseHelper.created(res, "Payment method updated successfully", {
      card: cardInfo,
    });
  } catch (error: any) {
    console.error("Error in updatePaymentMethod:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/payment-methods/:paymentMethodId/set-default
 * Set a payment method as default
 */
export async function setDefaultPaymentMethod(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { paymentMethodId } = req.params;

    // Validate paymentMethodId
    const validationResult = setDefaultPaymentMethodSchema.safeParse({
      paymentMethodId,
    });
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    await paymentMethodsService.setDefaultPaymentMethod(
      userId,
      validationResult.data.paymentMethodId
    );

    return ResponseHelper.success(
      res,
      "Default payment method updated successfully"
    );
  } catch (error: any) {
    console.error("Error in setDefaultPaymentMethod:", error);
    const status = getErrorStatus(error);
    let message = error.message || "Internal server error";

    // Customize message for specific errors
    if (error.message.includes("canceled subscription")) {
      message = "Cannot update payment method for canceled subscription";
    }

    return res.status(status).json({
      success: false,
      message,
    });
  }
}

/**
 * DELETE /api/payment-methods/:paymentMethodId
 * Remove a payment method
 */
export async function removePaymentMethod(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserIdFromRequest(req);
    const { paymentMethodId } = req.params;

    // Validate paymentMethodId
    const validationResult = removePaymentMethodSchema.safeParse({
      paymentMethodId,
    });
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    await paymentMethodsService.removePaymentMethod(
      userId,
      validationResult.data.paymentMethodId
    );

    return ResponseHelper.success(res, "Payment method removed successfully");
  } catch (error: any) {
    console.error("Error in removePaymentMethod:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}
