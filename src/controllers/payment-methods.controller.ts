import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { PaymentMethodsService } from "../services/payment-methods.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateUpdatePaymentMethod,
  validateSetDefaultPaymentMethod,
  validateRemovePaymentMethod,
} from "../validations/paymentMethods.validations";
import {
  getUserIdFromRequest,
  getErrorStatus,
  formatPaymentMethodErrorMessage,
} from "../utils/paymentMethodsHelpers";

// ==================== SERVICE INSTANCE ====================
const paymentMethodsService = new PaymentMethodsService();

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
    const validationResult = validateUpdatePaymentMethod(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { setupIntentId, setAsDefault } = validationResult.data!;

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

    // Validate route parameters
    const validationResult = validateSetDefaultPaymentMethod(req.params);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { paymentMethodId } = validationResult.data!;

    await paymentMethodsService.setDefaultPaymentMethod(
      userId,
      paymentMethodId
    );

    return ResponseHelper.success(
      res,
      "Default payment method updated successfully"
    );
  } catch (error: any) {
    console.error("Error in setDefaultPaymentMethod:", error);
    const status = getErrorStatus(error);
    const message = formatPaymentMethodErrorMessage(error);

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

    // Validate route parameters
    const validationResult = validateRemovePaymentMethod(req.params);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { paymentMethodId } = validationResult.data!;

    await paymentMethodsService.removePaymentMethod(userId, paymentMethodId);

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
