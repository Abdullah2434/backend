import { Response } from "express";
import PaymentService from "../services/payment.service";
import { PaymentResponse } from "../types/payment.types";
import { logPaymentError } from "../utils/payment.utils";

const paymentService = new PaymentService();

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

export const getPaymentMethods = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const paymentMethods = await paymentService.getPaymentMethods(
      req.user!._id
    );
    sendResponse(res, 200, "Payment methods retrieved successfully", {
      paymentMethods,
      count: paymentMethods.length,
    });
  } catch (error: any) {
    logPaymentError(error, {
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

export const createSetupIntent = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { returnUrl } = req.body;
    const result = await paymentService.createSetupIntent(
      req.user!._id,
      returnUrl
    );
    sendResponse(res, 200, "Setup intent created successfully", result);
  } catch (error: any) {
    logPaymentError(error, {
      userId: req.user?._id,
      action: "createSetupIntent",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to create setup intent"
    );
  }
};

export const updatePaymentMethod = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { setupIntentId, paymentMethodId } = req.body;
    const result = await paymentService.updatePaymentMethod(
      req.user!._id,
      setupIntentId,
      paymentMethodId
    );
    sendResponse(res, 200, "Payment method updated successfully", {
      paymentMethod: result,
    });
  } catch (error: any) {
    logPaymentError(error, {
      userId: req.user?._id,
      setupIntentId: req.body.setupIntentId,
      action: "updatePaymentMethod",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to update payment method"
    );
  }
};

export const setDefaultPaymentMethod = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { paymentMethodId } = req.params;
    const result = await paymentService.setDefaultPaymentMethod(
      req.user!._id,
      paymentMethodId
    );
    sendResponse(res, 200, "Default payment method set successfully", {
      paymentMethod: result,
    });
  } catch (error: any) {
    logPaymentError(error, {
      userId: req.user?._id,
      paymentMethodId: req.params.paymentMethodId,
      action: "setDefaultPaymentMethod",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to set default payment method"
    );
  }
};

export const removePaymentMethod = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { paymentMethodId } = req.params;
    await paymentService.removePaymentMethod(req.user!._id, paymentMethodId);
    sendResponse(res, 200, "Payment method removed successfully");
  } catch (error: any) {
    logPaymentError(error, {
      userId: req.user?._id,
      paymentMethodId: req.params.paymentMethodId,
      action: "removePaymentMethod",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to remove payment method"
    );
  }
};

export const getPaymentStats = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const stats = await paymentService.getPaymentStats(req.user!._id);
    sendResponse(res, 200, "Payment stats retrieved successfully", stats);
  } catch (error: any) {
    logPaymentError(error, {
      userId: req.user?._id,
      action: "getPaymentStats",
    });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve payment stats"
    );
  }
};

export const getCustomer = async (req: any, res: Response): Promise<void> => {
  try {
    const customer = await paymentService.getCustomer(req.user!._id);
    if (!customer) {
      sendResponse(res, 404, "Customer not found");
      return;
    }
    sendResponse(res, 200, "Customer retrieved successfully", customer);
  } catch (error: any) {
    logPaymentError(error, { userId: req.user?._id, action: "getCustomer" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve customer"
    );
  }
};

export const healthCheck = async (req: any, res: Response): Promise<void> => {
  try {
    const health = await paymentService.healthCheck();
    const statusCode = health.status === "healthy" ? 200 : 503;
    sendResponse(
      res,
      statusCode,
      `Payment service is ${health.status}`,
      health
    );
  } catch (error: any) {
    logPaymentError(error, { action: "healthCheck" });
    sendResponse(res, 500, "Health check failed");
  }
};
