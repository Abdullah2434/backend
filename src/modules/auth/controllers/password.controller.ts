import { Request, Response } from "express";
import { passwordService } from "../services/password.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Request password reset
 */
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    const result = await passwordService.forgotPassword(email);

    return ResponseHelper.success(res, result.message);
  }
);

/**
 * Reset password with token
 */
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { resetToken, newPassword } = req.body;

    const result = await passwordService.resetPassword({
      resetToken,
      newPassword,
    });

    return ResponseHelper.success(res, result.message);
  }
);

/**
 * Validate reset token
 */
export const validateResetToken = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.body;

    const result = await passwordService.validateResetToken(token);

    return ResponseHelper.success(res, "Token validation completed", {
      isValid: result.isValid,
    });
  }
);

/**
 * Debug password hash (development only)
 */
export const debugPasswordHash = asyncHandler(
  async (req: Request, res: Response) => {
    const { password } = req.body;

    const hash = await passwordService.debugPasswordHash(password);

    return ResponseHelper.success(res, "Password hash generated", { hash });
  }
);
