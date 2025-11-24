import { AuthenticatedRequest } from "../types";

// ==================== HELPER FUNCTIONS ====================

/**
 * Get user ID from authenticated request
 */
export function getUserIdFromRequest(req: AuthenticatedRequest): string {
  if (!req.user?._id) {
    throw new Error("User not authenticated");
  }
  return req.user._id;
}

/**
 * Determine HTTP status code based on error message
 */
export function getErrorStatus(error: Error): number {
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

/**
 * Format error message for payment method operations
 */
export function formatPaymentMethodErrorMessage(error: Error): string {
  let message = error.message || "Internal server error";

  // Customize message for specific errors
  if (error.message.includes("canceled subscription")) {
    message = "Cannot update payment method for canceled subscription";
  }

  return message;
}

