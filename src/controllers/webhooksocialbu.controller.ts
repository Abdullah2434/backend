import { Request, Response } from "express";
import webhookService from "../services/webhooksocialbu.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateSocialBuWebhook,
  validateUserIdQuery,
  validateUserIdParam,
  validateRemoveSocialBuAccount,
} from "../validations/webhookSocialbu.validations";
import {
  parseJsonBody,
  getUserIdFromQuery,
  buildSocialBuWebhookPayload,
  formatWebhookDebug,
  getErrorStatus,
} from "../utils/webhookSocialbuHelpers";

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Test webhook endpoint
 */
export const testWebhook = async (req: Request, res: Response) => {
  try {
    const parsedBody = parseJsonBody(req.body);

    return ResponseHelper.success(res, "Webhook test successful", {
      originalBody: req.body,
      parsedBody: parsedBody,
      hasBody: !!req.body,
      bodyType: typeof req.body,
      headers: req.headers,
    });
  } catch (error: any) {
    console.error("Error in testWebhook:", error);
    return ResponseHelper.serverError(
      res,
      "Test webhook failed",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle SocialBu account webhook
 */
export const handleSocialBuWebhook = async (req: Request, res: Response) => {
  try {
    // Parse body if it's a string
    const webhookData = parseJsonBody(req.body);

    // Validate webhook payload
    const validationResult = validateSocialBuWebhook(webhookData);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Invalid webhook payload",
        validationResult.errors
      );
    }

    // Validate and extract user_id from query (optional)
    const queryValidation = validateUserIdQuery(req.query);
    if (!queryValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Invalid query parameters",
        queryValidation.errors
      );
    }

    const userId = getUserIdFromQuery(req);

    // Process the webhook with user ID
    const result = await webhookService.handleSocialBuAccountWebhook(
      buildSocialBuWebhookPayload(validationResult.data!),
      userId
    );

    if (!result.success) {
      return ResponseHelper.badRequest(
        res,
        result.message || "Failed to process webhook"
      );
    }

    return ResponseHelper.success(
      res,
      result.message || "Webhook processed successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Error in handleSocialBuWebhook:", error);
    const statusCode = getErrorStatus(error);

    if (statusCode === 400) {
      return ResponseHelper.badRequest(
        res,
        "Failed to process webhook",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    return ResponseHelper.serverError(res, "Failed to process webhook", {
      error: error instanceof Error ? error.message : "Unknown error",
      debug: formatWebhookDebug(req),
    });
  }
};

/**
 * Get user's SocialBu account IDs
 */
export const getUserSocialBuAccounts = async (req: Request, res: Response) => {
  try {
    // Validate userId parameter
    const paramValidation = validateUserIdParam(req.params);
    if (!paramValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Invalid user ID parameter",
        paramValidation.errors
      );
    }

    const { userId } = paramValidation.data!;

    const result = await webhookService.getUserSocialBuAccounts(userId);

    if (!result.success) {
      return ResponseHelper.badRequest(
        res,
        result.message || "Failed to get SocialBu accounts"
      );
    }

    return ResponseHelper.success(
      res,
      result.message || "SocialBu accounts retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Error in getUserSocialBuAccounts:", error);
    const statusCode = getErrorStatus(error);

    if (statusCode === 400) {
      return ResponseHelper.badRequest(
        res,
        "Failed to get SocialBu accounts",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    return ResponseHelper.serverError(
      res,
      "Failed to get SocialBu accounts",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Remove specific SocialBu account from user
 */
export const removeUserSocialBuAccount = async (
  req: Request,
  res: Response
) => {
  try {
    // Validate userId parameter
    const paramValidation = validateUserIdParam(req.params);
    if (!paramValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Invalid user ID parameter",
        paramValidation.errors
      );
    }

    const { userId } = paramValidation.data!;

    // Validate request body
    const bodyValidation = validateRemoveSocialBuAccount(req.body);
    if (!bodyValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Invalid request body",
        bodyValidation.errors
      );
    }

    const { accountId } = bodyValidation.data!;

    const result = await webhookService.removeUserSocialBuAccount(
      userId,
      accountId
    );

    if (!result.success) {
      return ResponseHelper.badRequest(
        res,
        result.message || "Failed to remove SocialBu account"
      );
    }

    return ResponseHelper.success(
      res,
      result.message || "SocialBu account removed successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Error in removeUserSocialBuAccount:", error);
    const statusCode = getErrorStatus(error);

    if (statusCode === 400) {
      return ResponseHelper.badRequest(
        res,
        "Failed to remove SocialBu account",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    return ResponseHelper.serverError(
      res,
      "Failed to remove SocialBu account",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};
