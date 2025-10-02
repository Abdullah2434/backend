import { Request, Response } from "express";
import { socialBuAuthService } from "../services/auth.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Manual login to SocialBu and save token
 */
export const manualLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await socialBuAuthService.manualLogin();

  if (!result.success) {
    return ResponseHelper.badRequest(res, result.message);
  }

  return ResponseHelper.success(res, result.message, result.data);
});

/**
 * Save token manually (for initial setup)
 */
export const saveToken = asyncHandler(async (req: Request, res: Response) => {
  const { authToken, id, name, email, verified } = req.body;

  if (!authToken || !id || !name || !email) {
    return ResponseHelper.badRequest(
      res,
      "authToken, id, name, and email are required"
    );
  }

  const result = await socialBuAuthService.saveToken({
    authToken,
    id,
    name,
    email,
    verified: verified || false,
  });

  if (!result.success) {
    return ResponseHelper.badRequest(res, result.message, result.error);
  }

  return ResponseHelper.success(res, result.message, result.data);
});

/**
 * Test authentication
 */
export const testAuth = asyncHandler(async (req: Request, res: Response) => {
  const result = await socialBuAuthService.testAuth();

  if (!result.success) {
    return ResponseHelper.badRequest(res, result.message, result.error);
  }

  return ResponseHelper.success(res, result.message, result.data);
});
