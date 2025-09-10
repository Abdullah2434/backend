import { Request, Response } from "express";
import { PaymentMethodsService } from "../services/payment-methods.service";
import AuthService from "../services/auth.service";
import { ApiResponse } from "../types";

const paymentMethodsService = new PaymentMethodsService();
const authService = new AuthService();

function requireAuth(req: Request) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) throw new Error("Access token is required");
  const payload = authService.verifyToken(token);
  if (!payload) throw new Error("Invalid or expired access token");
  return payload;
}

/**
 * GET /api/payment-methods
 * Fetch all saved payment methods for the logged-in user
 */
export async function getPaymentMethods(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    
    console.log(`🔍 Fetching payment methods for user: ${payload.userId}`);
    
    const paymentMethods = await paymentMethodsService.getPaymentMethods(payload.userId);
    
    console.log(`✅ Found ${paymentMethods.length} payment methods for user`);
    
    return res.json({
      success: true,
      message: "Payment methods retrieved successfully",
      data: {
        paymentMethods,
        count: paymentMethods.length,
      },
    });
  } catch (e: any) {
    console.error("❌ Error fetching payment methods:", e.message);
    
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * POST /api/payment-methods/setup-intent
 * Create a SetupIntent for collecting new payment method
 */
export async function createSetupIntent(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    
    console.log(`🔍 Creating setup intent for user: ${payload.userId}`);
    
    const setupIntentData = await paymentMethodsService.createSetupIntent(payload.userId);
    
    console.log(`✅ Setup intent created: ${setupIntentData.setupIntent.id}`);
    
    return res.json({
      success: true,
      message: "Setup intent created successfully",
      data: setupIntentData,
    });
  } catch (e: any) {
    console.error("❌ Error creating setup intent:", e.message);
    
    const status = e.message.includes("Access token") ? 401 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * POST /api/payment-methods/update
 * Confirm SetupIntent and attach payment method to customer
 */
export async function updatePaymentMethod(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { setupIntentId, setAsDefault } = req.body;

    if (!setupIntentId) {
      return res.status(400).json({
        success: false,
        message: "Setup intent ID is required",
      });
    }

    console.log(`🔍 Confirming setup intent: ${setupIntentId} for user: ${payload.userId}`);
    
    const cardInfo = await paymentMethodsService.confirmSetupIntent(
      payload.userId,
      setupIntentId,
      setAsDefault || false
    );
    
    console.log(`✅ Payment method confirmed and attached: ${cardInfo.id}`);
    
    return res.status(201).json({
      success: true,
      message: "Payment method updated successfully",
      data: {
        card: cardInfo,
      },
    });
  } catch (e: any) {
    console.error("❌ Error updating payment method:", e.message);
    
    const status = e.message.includes("Access token") ? 401 : 
                   e.message.includes("not succeeded") ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * POST /api/payment-methods/:paymentMethodId/set-default
 * Set a payment method as default
 */
export async function setDefaultPaymentMethod(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { paymentMethodId } = req.params;

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment method ID is required",
      });
    }

    console.log(`🔍 Setting default payment method: ${paymentMethodId} for user: ${payload.userId}`);
    
    await paymentMethodsService.setDefaultPaymentMethod(payload.userId, paymentMethodId);
    
    console.log(`✅ Payment method set as default: ${paymentMethodId}`);
    
    return res.json({
      success: true,
      message: "Default payment method updated successfully",
    });
  } catch (e: any) {
    console.error("❌ Error setting default payment method:", e.message);
    
    const status = e.message.includes("Access token") ? 401 : 
                   e.message.includes("does not belong") ? 403 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

/**
 * DELETE /api/payment-methods/:paymentMethodId
 * Remove a payment method
 */
export async function removePaymentMethod(req: Request, res: Response) {
  try {
    const payload = requireAuth(req);
    const { paymentMethodId } = req.params;

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Payment method ID is required",
      });
    }

    console.log(`🔍 Removing payment method: ${paymentMethodId} for user: ${payload.userId}`);
    
    await paymentMethodsService.removePaymentMethod(payload.userId, paymentMethodId);
    
    console.log(`✅ Payment method removed: ${paymentMethodId}`);
    
    return res.json({
      success: true,
      message: "Payment method removed successfully",
    });
  } catch (e: any) {
    console.error("❌ Error removing payment method:", e.message);
    
    const status = e.message.includes("Access token") ? 401 : 
                   e.message.includes("does not belong") ? 403 :
                   e.message.includes("Cannot remove") ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}
