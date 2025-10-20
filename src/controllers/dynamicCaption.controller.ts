import { Request, Response } from "express";
import DynamicCaptionGenerationService, {
  UserContext,
} from "../services/dynamicCaptionGeneration.service";
import { AuthenticatedRequest } from "../types";

/**
 * Generate dynamic captions for a video topic
 */
export async function generateDynamicCaptions(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;
    const { topic, keyPoints, userContext } = req.body;

    if (!topic || !keyPoints) {
      return res.status(400).json({
        success: false,
        message: "Topic and keyPoints are required",
      });
    }

    // Prepare video data
    const videoData = {
      VIDEO_TOPIC: topic,
      SCRIPT_HOOK: topic,
      SCRIPT_SUMMARY: keyPoints,
      AGENT_NAME: userContext?.name || "Real Estate Professional",
      AGENT_CITY: userContext?.city || "Your City",
      AGENT_EMAIL: userContext?.email,
      AGENT_PHONE: userContext?.phone,
      AGENT_WEBSITE: userContext?.website,
      AGENT_SPECIALTY: userContext?.specialty,
    };

    // Generate dynamic captions
    const captions =
      await DynamicCaptionGenerationService.generateDynamicCaptions(
        userId!,
        videoData,
        userContext
      );

    return res.json({
      success: true,
      data: {
        captions,
        topic,
        keyPoints,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating dynamic captions:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate dynamic captions",
    });
  }
}

/**
 * Get user's post history for a specific platform
 */
export async function getUserPostHistory(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;
    const { platform } = req.params;
    const { limit = 10 } = req.query;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: "Platform is required",
      });
    }

    const validPlatforms = [
      "youtube",
      "instagram",
      "tiktok",
      "facebook",
      "linkedin",
    ];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid platform. Must be one of: youtube, instagram, tiktok, facebook, linkedin",
      });
    }

    // Import the service to access the static method
    const { DynamicPostGenerationService } = await import(
      "../services/dynamicPostGeneration.service"
    );

    const postHistory = await DynamicPostGenerationService.getPostHistory(
      userId!,
      platform,
      Number(limit)
    );

    return res.json({
      success: true,
      data: {
        platform,
        postHistory,
        totalPosts: postHistory.length,
      },
    });
  } catch (error: any) {
    console.error("Error getting user post history:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get user post history",
    });
  }
}

/**
 * Get available templates for a platform
 */
export async function getPlatformTemplates(req: Request, res: Response) {
  try {
    const { platform } = req.params;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: "Platform is required",
      });
    }

    const validPlatforms = [
      "youtube",
      "instagram",
      "tiktok",
      "facebook",
      "linkedin",
    ];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid platform. Must be one of: youtube, instagram, tiktok, facebook, linkedin",
      });
    }

    // Import the service to access the static method
    const { TemplateLibraryService } = await import(
      "../services/templateLibrary.service"
    );

    const templates = TemplateLibraryService.getTemplatesByPlatform(platform);

    return res.json({
      success: true,
      data: {
        platform,
        templates,
        totalTemplates: templates.length,
      },
    });
  } catch (error: any) {
    console.error("Error getting platform templates:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get platform templates",
    });
  }
}

/**
 * Test the dynamic caption generation system
 */
export async function testDynamicSystem(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?._id;
    const { topic, keyPoints } = req.body;

    if (!topic || !keyPoints) {
      return res.status(400).json({
        success: false,
        message: "Topic and keyPoints are required",
      });
    }

    // Test data
    const testVideoData = {
      VIDEO_TOPIC: topic,
      SCRIPT_HOOK: topic,
      SCRIPT_SUMMARY: keyPoints,
      AGENT_NAME: "Test Agent",
      AGENT_CITY: "Test City",
    };

    const testUserContext: UserContext = {
      name: "Test Agent",
      position: "Real Estate Professional",
      companyName: "Test Company",
      city: "Test City",
      email: "test@example.com",
      phone: "555-0123",
      website: "https://test.com",
      specialty: "Residential Real Estate",
      socialHandles: "@testagent",
    };

    // Test each platform
    const platforms = [
      "youtube",
      "instagram",
      "tiktok",
      "facebook",
      "linkedin",
    ];
    const results: { [key: string]: any } = {};

    for (const platform of platforms) {
      try {
        const result =
          await DynamicCaptionGenerationService.generateDynamicCaptions(
            userId!,
            testVideoData,
            testUserContext
          );
        results[platform] = {
          success: true,
          caption: result[`${platform}_caption` as keyof typeof result],
        };
      } catch (error: any) {
        results[platform] = {
          success: false,
          error: error.message,
        };
      }
    }

    return res.json({
      success: true,
      data: {
        testResults: results,
        topic,
        keyPoints,
        testedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error testing dynamic system:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to test dynamic system",
    });
  }
}
