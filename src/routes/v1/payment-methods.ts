import { Router } from "express";
import {
  getPaymentMethods,
  createSetupIntent,
  updatePaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
} from "../../controllers/payment-methods.controller";

const router = Router();

// Get all saved payment methods for user
router.get("/", getPaymentMethods as any);

// Create setup intent for adding/updating payment method
router.post("/setup-intent", createSetupIntent as any);

// Update payment method (confirm SetupIntent)
router.post("/update", updatePaymentMethod as any);

// Set payment method as default
router.post("/:paymentMethodId/set-default", setDefaultPaymentMethod as any);

// Remove payment method
router.delete("/:paymentMethodId", removePaymentMethod as any);

export default router;
