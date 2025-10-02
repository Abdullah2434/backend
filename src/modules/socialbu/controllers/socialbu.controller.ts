import { Response } from "express";
import SocialBuService from "../services/socialbu.service";
import { SocialBuResponse } from "../types/socialbu.types";
import { logSocialBuError, maskAuthToken } from "../utils/socialbu.utils";

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

export const manualLogin = async (req: any, res: Response): Promise<void> => {
  try {
    const result = await socialBuService.manualLogin();

    if (result.success) {
      sendResponse(res, 200, result.message, result.data);
    } else {
      sendResponse(res, 400, result.message);
    }
  } catch (error: any) {
    logSocialBuError(error, { action: "manualLogin" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to login to SocialBu"
    );
  }
};

export const saveToken = async (req: any, res: Response): Promise<void> => {
  try {
    const { authToken, id, name, email, verified } = req.body;

    const result = await socialBuService.saveToken({
      authToken,
      id,
      name,
      email,
      verified,
    });

    sendResponse(res, 200, "Token saved successfully", result);
  } catch (error: any) {
    logSocialBuError(error, { action: "saveToken" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to save token"
    );
  }
};

export const getToken = async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId;
    const result = await socialBuService.getToken(userId);

    if (result) {
      sendResponse(res, 200, "Token retrieved successfully", result);
    } else {
      sendResponse(res, 404, "No valid token found");
    }
  } catch (error: any) {
    logSocialBuError(error, { action: "getToken" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve token"
    );
  }
};

export const validateToken = async (req: any, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      sendResponse(res, 400, "Token is required");
      return;
    }

    const isValid = await socialBuService.validateToken(token);

    sendResponse(res, 200, "Token validation completed", {
      valid: isValid,
      token: maskAuthToken(token),
    });
  } catch (error: any) {
    logSocialBuError(error, { action: "validateToken" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to validate token"
    );
  }
};

export const refreshToken = async (req: any, res: Response): Promise<void> => {
  try {
    const result = await socialBuService.refreshToken();

    if (result.success) {
      sendResponse(res, 200, result.message, result.data);
    } else {
      sendResponse(res, 400, result.message);
    }
  } catch (error: any) {
    logSocialBuError(error, { action: "refreshToken" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to refresh token"
    );
  }
};

export const logout = async (req: any, res: Response): Promise<void> => {
  try {
    await socialBuService.logout();
    sendResponse(res, 200, "Logged out successfully");
  } catch (error: any) {
    logSocialBuError(error, { action: "logout" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to logout"
    );
  }
};

export const getAccounts = async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const result = await socialBuService.getAccounts(userId);

    if (result.success) {
      sendResponse(res, 200, result.message, result.data);
    } else {
      sendResponse(res, 400, result.message);
    }
  } catch (error: any) {
    logSocialBuError(error, { action: "getAccounts" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve accounts"
    );
  }
};

export const getPublicAccounts = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    // Return public account information (no sensitive data)
    const result = await socialBuService.getPublicAccounts();

    if (result.success) {
      sendResponse(res, 200, result.message, result.data);
    } else {
      sendResponse(res, 400, result.message);
    }
  } catch (error: any) {
    logSocialBuError(error, { action: "getPublicAccounts" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to retrieve public accounts"
    );
  }
};

export const connectAccount = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const accountData = req.body;
    const result = await socialBuService.connectAccount(accountData);

    if (result.success) {
      sendResponse(res, 200, result.message, result.data);
    } else {
      sendResponse(res, 400, result.message);
    }
  } catch (error: any) {
    logSocialBuError(error, { action: "connectAccount" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to connect account"
    );
  }
};

export const disconnectAccount = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const { accountId } = req.params;
    const result = await socialBuService.disconnectAccount(accountId);

    if (result.success) {
      sendResponse(res, 200, result.message, result.data);
    } else {
      sendResponse(res, 400, result.message);
    }
  } catch (error: any) {
    logSocialBuError(error, { action: "disconnectAccount" });
    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to disconnect account"
    );
  }
};

export const getStatus = async (req: any, res: Response): Promise<void> => {
  try {
    const health = await socialBuService.healthCheck();
    const statusCode = health.status === "healthy" ? 200 : 503;

    sendResponse(
      res,
      statusCode,
      `SocialBu service is ${health.status}`,
      health
    );
  } catch (error: any) {
    logSocialBuError(error, { action: "getStatus" });
    sendResponse(res, 500, "Failed to get SocialBu status");
  }
};

export const getConfig = async (req: any, res: Response): Promise<void> => {
  try {
    const config = socialBuService.getConfig();

    // Remove sensitive information
    const safeConfig = {
      apiUrl: config.apiUrl,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts,
      retryDelay: config.retryDelay,
      enableLogging: config.enableLogging,
      enableWebhooks: config.enableWebhooks,
      rateLimitWindow: config.rateLimitWindow,
      rateLimitMax: config.rateLimitMax,
    };

    sendResponse(res, 200, "SocialBu configuration retrieved", safeConfig);
  } catch (error: any) {
    logSocialBuError(error, { action: "getConfig" });
    sendResponse(res, 500, "Failed to get SocialBu configuration");
  }
};
