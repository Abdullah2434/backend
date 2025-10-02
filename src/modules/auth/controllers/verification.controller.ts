import { Request, Response } from "express";
import { verificationService } from "../services/verification.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Verify email with token
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.query.token || "");

  const result = await verificationService.verifyEmail(token);

  return ResponseHelper.success(res, result.message, {
    user: {
      id: result.user._id,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      phone: result.user.phone,
      isEmailVerified: result.user.isEmailVerified,
    },
  });
});

/**
 * Resend verification email
 */
export const resendVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    const result = await verificationService.resendVerificationEmail(email);

    return ResponseHelper.success(res, result.message);
  }
);
