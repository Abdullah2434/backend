import { Request, Response } from "express";
import { UserVideoSettingsService } from "../services/userVideoSettings.service";

const userVideoSettingsService = new UserVideoSettingsService();

export async function getUserVideoSettings(req: Request, res: Response) {
  try {
    const { email } = req.query;

    if (!email || String(email).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const userSettings = await userVideoSettingsService.getUserVideoSettings(
      String(email)
    );

    if (!userSettings) {
      return res.status(404).json({
        success: false,
        message: "No video settings found for this user",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User video settings retrieved successfully",
      data: {
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
      },
    });
  } catch (error: any) {
    console.error("Error getting user video settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get user video settings",
      error: error.message,
    });
  }
}

export async function saveUserVideoSettings(req: Request, res: Response) {
  try {
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
        return res.status(400).json({
          success: false,
          message: "avatar field must be a valid array or JSON string",
        });
      }
    } else if (Array.isArray(avatar)) {
      // Avatar is already an array, use it directly
      avatarArray = avatar;
    } else if (typeof avatar === "object" && avatar !== null) {
      // Handle object with numeric keys (e.g., {'0': 'value1', '1': 'value2'})
      avatarArray = Object.values(avatar);
    } else {
      return res.status(400).json({
        success: false,
        message:
          "avatar field must be an array, object with numeric keys, or JSON string",
      });
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
      return res.status(400).json({
        success: false,
        message: "avatar is required",
      });
    }

    if (!Array.isArray(avatarArray) || avatarArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "avatar must be a non-empty array",
      });
    }

    // Validate other required fields
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`,
        });
      }

      // Regular string validation for other fields
      if (String(req.body[field]).trim() === "") {
        return res.status(400).json({
          success: false,
          message: `${field} cannot be empty`,
        });
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

    return res.status(200).json({
      success: true,
      message: "User video settings saved successfully",
      data: {
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
      },
    });
  } catch (error: any) {
    console.error("Error saving user video settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save user video settings",
      error: error.message,
    });
  }
}
