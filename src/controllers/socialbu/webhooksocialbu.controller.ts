import { Request, Response } from "express";
import { webhookService } from "../../services/socialbu";
import { ResponseHelper } from "../../utils/responseHelper";
import {
  socialBuWebhookSchema,
  userIdQuerySchema,
  userIdParamSchema,
  removeSocialBuAccountSchema,
} from "../../validations/webhookSocialbu.validations";
import {
  formatValidationErrors,
  handleControllerError,
} from "../../utils/controllerHelpers";

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
export const testWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const parsedBody = parseJsonBody(req.body);

    return ResponseHelper.success(res, "Webhook test successful", {
      originalBody: req.body,
      parsedBody: parsedBody,
      hasBody: !!req.body,
      bodyType: typeof req.body,
      headers: req.headers,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "testWebhook",
      "Test webhook failed"
    );
  }
};

/**
 * Handle SocialBu account webhook
 */
export const handleSocialBuWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Parse body if it's a string
    const webhookData = parseJsonBody(req.body);

    // Validate webhook payload
    const validationResult = socialBuWebhookSchema.safeParse(webhookData);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return ResponseHelper.badRequest(res, "Invalid webhook payload", errors);
    }

    const validatedData = validationResult.data;

    // Validate and extract user_id from query (optional)
    const queryValidation = userIdQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      const errors = formatValidationErrors(queryValidation.error);
      return ResponseHelper.badRequest(
        res,
        "Invalid query parameters",
        errors
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

    return ResponseHelper.success(
      res,
      result.message || "Webhook processed successfully",
      result.data
    );
  } catch (error) {
    // For webhook errors, include debug info
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in handleSocialBuWebhook:", err);

    // Check if it's a validation error
    if (
      err.name === "ValidationError" ||
      err.name === "ZodError" ||
      err.message.toLowerCase().includes("invalid") ||
      err.message.toLowerCase().includes("required")
    ) {
      return ResponseHelper.badRequest(
        res,
        "Failed to process webhook",
        err.message
      );
    }

    return ResponseHelper.serverError(res, "Failed to process webhook", {
      error: err.message,
        debug: formatWebhookDebug(req),
    });
  }
};

/**
 * Get user's SocialBu account IDs
 */
export const getUserSocialBuAccounts = async (
  req: Request,
  res: Response
): Promise<Response> => {
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
  } catch (error) {
    return handleControllerError(
      error,
        res,
      "getUserSocialBuAccounts",
      "Failed to get SocialBu accounts"
    );
  }
};

/**
 * Remove specific SocialBu account from user
 */
export const removeUserSocialBuAccount = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Validate userId parameter
    const paramValidation = userIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      const errors = formatValidationErrors(paramValidation.error);
      return ResponseHelper.badRequest(
        res,
        "Invalid user ID parameter",
        errors
      );
    }

    const { userId } = paramValidation.data;

    // Validate request body
    const bodyValidation = removeSocialBuAccountSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      const errors = formatValidationErrors(bodyValidation.error);
      return ResponseHelper.badRequest(res, "Invalid request body", errors);
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
  } catch (error) {
    return handleControllerError(
      error,
        res,
      "removeUserSocialBuAccount",
      "Failed to remove SocialBu account"
    );
  }
};
