import { Request, Response } from "express";
import { userVideoSettingsService } from "../services/user-settings.service";
import { ResponseHelper } from "../../../core/utils/response";
import { asyncHandler } from "../../../core/errors/ErrorHandler";
import { UserVideoSettingsResponse } from "../types/user-settings.types";

/**
 * Get user video settings
 */
export const getUserVideoSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.query;

    if (!email || String(email).trim() === "") {
      return ResponseHelper.badRequest(res, "Email is required");
    }

    const userSettings = await userVideoSettingsService.getUserVideoSettings(
      String(email)
    );

    if (!userSettings) {
      return ResponseHelper.notFound(
        res,
        "No video settings found for this user"
      );
    }

    const responseData: UserVideoSettingsResponse = {
      prompt: userSettings.prompt,
      avatar: userSettings.avatar,
      titleAvatar: userSettings.titleAvatar,
      conclusionAvatar: userSettings.conclusionAvatar,
      name: userSettings.name,
      position: userSettings.position,
      companyName: userSettings.companyName,
      license: userSettings.license,
      tailoredFit: userSettings.tailoredFit,
      socialHandles: userSettings.socialHandles,
      city: userSettings.city,
      preferredTone: userSettings.preferredTone,
      callToAction: userSettings.callToAction,
      email: userSettings.email,
      updatedAt: userSettings.updatedAt,
    };

    return ResponseHelper.success(
      res,
      "User video settings retrieved successfully",
      responseData
    );
  }
);

/**
 * Save user video settings
 */
export const saveUserVideoSettings = asyncHandler(
  async (req: Request, res: Response) => {
    console.log("Received request body:", JSON.stringify(req.body, null, 2));

    const {
      prompt,
      avatar,
      titleAvatar,
      conclusionAvatar,
      name,
      position,
      companyName,
      license,
      tailoredFit,
      socialHandles,
      city,
      preferredTone,
      callToAction,
      email,
    } = req.body;

    // Handle avatar field - it might be sent as a string, array, or object with numeric keys
    let avatarArray = avatar;
    console.log(avatar, "avatar");

    if (typeof avatar === "string") {
      try {
        avatarArray = JSON.parse(avatar);
      } catch (parseError) {
        console.error("Error parsing avatar string:", parseError);
        return ResponseHelper.badRequest(
          res,
          "Avatar field must be a valid array or JSON string"
        );
      }
    } else if (Array.isArray(avatar)) {
      // Avatar is already an array, use it directly
      avatarArray = avatar;
    } else if (typeof avatar === "object" && avatar !== null) {
      // Handle object with numeric keys (e.g., {'0': 'value1', '1': 'value2'})
      avatarArray = Object.values(avatar);
    } else {
      return ResponseHelper.badRequest(
        res,
        "Avatar field must be an array, object with numeric keys, or JSON string"
      );
    }

    // Validate required fields
    const requiredFields = [
      "prompt",
      "titleAvatar",
      "conclusionAvatar",
      "name",
      "position",
      "companyName",
      "license",
      "tailoredFit",
      "socialHandles",
      "city",
      "preferredTone",
      "callToAction",
      "email",
    ];

    // Validate avatar separately
    if (!avatar) {
      return ResponseHelper.badRequest(res, "Avatar is required");
    }

    if (!Array.isArray(avatarArray) || avatarArray.length === 0) {
      return ResponseHelper.badRequest(res, "Avatar must be a non-empty array");
    }

    // Validate other required fields
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return ResponseHelper.badRequest(res, `${field} is required`);
      }

      // Regular string validation for other fields
      if (String(req.body[field]).trim() === "") {
        return ResponseHelper.badRequest(res, `${field} cannot be empty`);
      }
    }

    // Save or update user video settings
    const savedSettings = await userVideoSettingsService.saveUserVideoSettings({
      prompt,
      avatar: avatarArray,
      titleAvatar,
      conclusionAvatar,
      name,
      position,
      companyName,
      license,
      tailoredFit,
      socialHandles,
      city,
      preferredTone,
      callToAction,
      email,
    });

    const responseData: UserVideoSettingsResponse = {
      prompt: savedSettings.prompt,
      avatar: savedSettings.avatar,
      titleAvatar: savedSettings.titleAvatar,
      conclusionAvatar: savedSettings.conclusionAvatar,
      name: savedSettings.name,
      position: savedSettings.position,
      companyName: savedSettings.companyName,
      license: savedSettings.license,
      tailoredFit: savedSettings.tailoredFit,
      socialHandles: savedSettings.socialHandles,
      city: savedSettings.city,
      preferredTone: savedSettings.preferredTone,
      callToAction: savedSettings.callToAction,
      email: savedSettings.email,
      updatedAt: savedSettings.updatedAt,
    };

    return ResponseHelper.success(
      res,
      "User video settings saved successfully",
      responseData
    );
  }
);
