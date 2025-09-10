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
router.get("/", getPaymentMethods);

// Create setup intent for adding/updating payment method
router.post("/setup-intent", createSetupIntent);

// Update payment method (confirm SetupIntent)
router.post("/update", updatePaymentMethod);

// Set payment method as default
router.post("/:paymentMethodId/set-default", setDefaultPaymentMethod);

// Remove payment method
router.delete("/:paymentMethodId", removePaymentMethod);

export default router;
