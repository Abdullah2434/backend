import { Request, Response } from "express";
import webhookService from "../services/webhooksocialbu.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  socialBuWebhookSchema,
  userIdQuerySchema,
  userIdParamSchema,
  removeSocialBuAccountSchema,
} from "../validations/webhookSocialbu.validations";

// ==================== CONSTANTS ====================
const VALID_ACCOUNT_ACTIONS = ["added", "updated", "removed"] as const;

// ==================== HELPER FUNCTIONS ====================
/**
 * Parse JSON body if it's a string
 */
function parseJsonBody(body: any): any {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (error) {
      console.error("Failed to parse JSON body:", error);
      return body;
    }
  }
  return body;
}

/**
 * Extract user ID from query parameters
 */
function getUserIdFromQuery(req: Request): string | undefined {
  return req.query.user_id as string | undefined;
}

/**
 * Get error status code based on error type
 */
function getErrorStatus(error: any): number {
  if (error?.name === "ValidationError" || error?.name === "ZodError") {
    return 400;
  }
  return 500;
}

/**
 * Format webhook debug information
 */
function formatWebhookDebug(req: Request, parsedBody?: any) {
  return {
    requestMethod: req.method,
    requestUrl: req.url,
    hasBody: !!req.body,
    bodyType: typeof req.body,
    parsedBody: parsedBody || req.body,
  };
}

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
    const validationResult = socialBuWebhookSchema.safeParse(webhookData);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Invalid webhook payload",
        validationResult.error.errors
      );
    }

    const validatedData = validationResult.data;

    // Validate and extract user_id from query (optional)
    const queryValidation = userIdQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Invalid query parameters",
        queryValidation.error.errors
      );
    }

    const userId = getUserIdFromQuery(req);

    // Process the webhook with user ID
    const result = await webhookService.handleSocialBuAccountWebhook(
      {
        account_action: validatedData.account_action,
        account_id: validatedData.account_id,
        account_type: validatedData.account_type,
        account_name: validatedData.account_name,
      },
      userId
    );

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message || "Failed to process webhook");
    }

    return ResponseHelper.success(res, result.message || "Webhook processed successfully", result.data);
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

    return ResponseHelper.serverError(
      res,
      "Failed to process webhook",
      {
        error: error instanceof Error ? error.message : "Unknown error",
        debug: formatWebhookDebug(req),
      }
    );
  }
};

/**
 * Get user's SocialBu account IDs
 */
export const getUserSocialBuAccounts = async (req: Request, res: Response) => {
  try {
    // Validate userId parameter
    const paramValidation = userIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Invalid user ID parameter",
        paramValidation.error.errors
      );
    }

    const { userId } = paramValidation.data;

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
export const removeUserSocialBuAccount = async (req: Request, res: Response) => {
  try {
    // Validate userId parameter
    const paramValidation = userIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Invalid user ID parameter",
        paramValidation.error.errors
      );
    }

    const { userId } = paramValidation.data;

    // Validate request body
    const bodyValidation = removeSocialBuAccountSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return ResponseHelper.badRequest(
        res,
        "Invalid request body",
        bodyValidation.error.errors
      );
    }

    const { accountId } = bodyValidation.data;

    const result = await webhookService.removeUserSocialBuAccount(userId, accountId);

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
