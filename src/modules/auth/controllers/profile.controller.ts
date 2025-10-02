import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { ResponseHelper } from "../../../core/utils/response";

/**
 * Get current user profile
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");

  const user = await authService.getCurrentUser(token);

  if (!user) {
    return ResponseHelper.unauthorized(res, "Invalid or expired access token");
  }

  return ResponseHelper.success(res, "User profile retrieved successfully", {
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      googleId: user.googleId,
    },
  });
});

/**
 * Update user profile
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");

    const currentUser = await authService.getCurrentUser(token);

    if (!currentUser) {
      return ResponseHelper.unauthorized(
        res,
        "Invalid or expired access token"
      );
    }

    const { firstName, lastName, phone } = req.body;

    const updatedUser = await authService.updateProfile(
      currentUser._id.toString(),
      {
        firstName,
        lastName,
        phone,
      }
    );

    return ResponseHelper.success(res, "Profile updated successfully", {
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        isEmailVerified: updatedUser.isEmailVerified,
      },
    });
  }
);
