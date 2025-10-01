import { Response } from "express";
import WebhookService from "../services/webhook.service";
import { WebhookResponse } from "../types/webhook.types";
import { logWebhookError, maskSignature } from "../utils/webhook.utils";

const webhookService = new WebhookService();

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

export const handleStripeWebhook = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const signature = req.headers["stripe-signature"] as string;
    const payload = req.body as Buffer;

    if (!signature) {
      sendResponse(res, 400, "Missing Stripe signature header");
      return;
    }

    if (!Buffer.isBuffer(payload)) {
      sendResponse(res, 400, "Invalid request body format");
      return;
    }

    const result = await webhookService.handleWebhook(payload, signature);

    if (result.success) {
      sendResponse(res, 200, result.message, result.data);
    } else {
      sendResponse(res, 400, result.message, result.data);
    }
  } catch (error: any) {
    logWebhookError(error, {
      signature: req.headers["stripe-signature"]
        ? maskSignature(req.headers["stripe-signature"])
        : undefined,
      action: "handleStripeWebhook",
    });

    const statusCode = error.statusCode || 500;
    const message = error.message || "Webhook processing failed";
    sendResponse(res, statusCode, message);
  }
};

export const handleWebhookTest = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    sendResponse(res, 200, "Webhook test endpoint is working", {
      timestamp: new Date().toISOString(),
      method: req.method,
      headers: {
        contentType: req.headers["content-type"],
        userAgent: req.headers["user-agent"],
      },
    });
  } catch (error: any) {
    logWebhookError(error, { action: "handleWebhookTest" });
    sendResponse(res, 500, "Webhook test failed");
  }
};

export const getWebhookStatus = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const health = await webhookService.healthCheck();
    const statusCode = health.status === "healthy" ? 200 : 503;

    sendResponse(
      res,
      statusCode,
      `Webhook service is ${health.status}`,
      health
    );
  } catch (error: any) {
    logWebhookError(error, { action: "getWebhookStatus" });
    sendResponse(res, 500, "Failed to get webhook status");
  }
};

export const getWebhookConfig = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const config = webhookService.getConfig();

    // Remove sensitive information
    const safeConfig = {
      apiVersion: config.apiVersion,
      tolerance: config.tolerance,
      enableLogging: config.enableLogging,
      enableRetry: config.enableRetry,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
      rateLimitWindow: config.rateLimitWindow,
      rateLimitMax: config.rateLimitMax,
    };

    sendResponse(res, 200, "Webhook configuration retrieved", safeConfig);
  } catch (error: any) {
    logWebhookError(error, { action: "getWebhookConfig" });
    sendResponse(res, 500, "Failed to get webhook configuration");
  }
};

export const processWebhookEvent = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { event } = req.body;

    if (!event) {
      sendResponse(res, 400, "Event data is required");
      return;
    }

    const result = await webhookService.processEvent(event);

    if (result.success) {
      sendResponse(res, 200, "Event processed successfully", result);
    } else {
      sendResponse(res, 400, "Event processing failed", result);
    }
  } catch (error: any) {
    logWebhookError(error, { action: "processWebhookEvent" });
    sendResponse(res, 500, "Event processing failed");
  }
};

export const verifyWebhookSignature = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { payload, signature } = req.body;

    if (!payload || !signature) {
      sendResponse(res, 400, "Payload and signature are required");
      return;
    }

    const event = await webhookService.verifySignature(
      Buffer.from(payload, "base64"),
      signature
    );

    sendResponse(res, 200, "Signature verified successfully", {
      eventId: event.id,
      eventType: event.type,
      created: event.created,
    });
  } catch (error: any) {
    logWebhookError(error, { action: "verifyWebhookSignature" });
    sendResponse(res, 400, "Signature verification failed");
  }
};

export const checkEventStatus = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      sendResponse(res, 400, "Event ID is required");
      return;
    }

    const isProcessed = await webhookService.isEventProcessed(eventId);

    sendResponse(res, 200, "Event status retrieved", {
      eventId,
      processed: isProcessed,
    });
  } catch (error: any) {
    logWebhookError(error, { action: "checkEventStatus" });
    sendResponse(res, 500, "Failed to check event status");
  }
};

export const markEventProcessed = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      sendResponse(res, 400, "Event ID is required");
      return;
    }

    await webhookService.markEventAsProcessed(eventId);

    sendResponse(res, 200, "Event marked as processed", {
      eventId,
      processed: true,
    });
  } catch (error: any) {
    logWebhookError(error, { action: "markEventProcessed" });
    sendResponse(res, 500, "Failed to mark event as processed");
  }
};
