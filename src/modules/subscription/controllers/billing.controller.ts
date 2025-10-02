import { Request, Response } from "express";
import { billingService } from "../services/billing.service";
import { tokenService } from "../../auth/services/token.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Get billing history
 */
export const getBillingHistory = asyncHandler(
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

    const limit = parseInt(req.query.limit as string) || 10;

    const billingHistory = await billingService.getBillingHistory(
      payload.userId,
      limit
    );

    return ResponseHelper.success(
      res,
      "Billing history retrieved successfully",
      { billingHistory }
    );
  }
);

/**
 * Get billing summary
 */
export const getBillingSummary = asyncHandler(
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

    const summary = await billingService.getBillingSummary(payload.userId);

    return ResponseHelper.success(
      res,
      "Billing summary retrieved successfully",
      summary
    );
  }
);

/**
 * Sync billing from Stripe
 */
export const syncBillingFromStripe = asyncHandler(
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

    await billingService.syncFromStripe(payload.userId);

    return ResponseHelper.success(
      res,
      "Billing synced from Stripe successfully"
    );
  }
);
