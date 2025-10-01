import { Response } from "express";
import SocialBuService from "../services/socialbu.service";
import { SocialBuResponse } from "../types/socialbu.types";
import { logSocialBuError, logSocialBuEvent } from "../utils/socialbu.utils";

const socialBuService = new SocialBuService();

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

export const testWebhook = async (req: any, res: Response): Promise<void> => {
  try {
    logSocialBuEvent("webhook_test_request", {
      body: req.body,
      headers: req.headers,
      method: req.method,
    });

    // Try to parse body if it's a string
    let parsedBody = req.body;
    if (typeof req.body === "string") {
      try {
        parsedBody = JSON.parse(req.body);
      } catch (e) {
        console.error("Failed to parse JSON body:", e);
      }
    }

    sendResponse(res, 200, "Webhook test successful", {
      originalBody: req.body,
      parsedBody,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logSocialBuError(error, { action: "testWebhook" });
    sendResponse(res, 500, "Webhook test failed");
  }
};

export const handleSocialBuWebhook = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const webhookData = req.body;

    logSocialBuEvent("socialbu_webhook_received", {
      eventType: webhookData.event_type,
      accountId: webhookData.account_id,
      userId: webhookData.user_id,
    });

    const result = await socialBuService.handleWebhook(webhookData);

    if (result.success) {
      sendResponse(res, 200, result.message, result.data);
    } else {
      sendResponse(res, 400, result.message);
    }
  } catch (error: any) {
    logSocialBuError(error, { action: "handleSocialBuWebhook" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Webhook processing failed"
    );
  }
};

export const getUserSocialBuAccounts = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      sendResponse(res, 400, "User ID is required");
      return;
    }

    const result = await socialBuService.getAccounts(userId);

    if (result.success) {
      sendResponse(res, 200, result.message, result.data);
    } else {
      sendResponse(res, 400, result.message);
    }
  } catch (error: any) {
    logSocialBuError(error, { action: "getUserSocialBuAccounts" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to get user SocialBu accounts"
    );
  }
};

export const removeUserSocialBuAccount = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { accountId } = req.body;

    if (!userId) {
      sendResponse(res, 400, "User ID is required");
      return;
    }

    if (!accountId) {
      sendResponse(res, 400, "Account ID is required");
      return;
    }

    const result = await socialBuService.disconnectAccount(accountId);

    if (result.success) {
      sendResponse(res, 200, result.message, result.data);
    } else {
      sendResponse(res, 400, result.message);
    }
  } catch (error: any) {
    logSocialBuError(error, { action: "removeUserSocialBuAccount" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to remove SocialBu account"
    );
  }
};
