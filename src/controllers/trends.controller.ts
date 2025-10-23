import { Request, Response } from "express";
import {
  generateRealEstateTrends,
  generateCityBasedTrends,
  generateFromDescription,
} from "../services/trends.service";

export const getRealEstateTrends = async (req: Request, res: Response) => {
  try {
    console.log("Generating real estate trends...");

    const trends = await generateRealEstateTrends();

    res.status(200).json({
      success: true,
      message: "Real estate trends generated successfully",
      data: {
        topic: "real_estate",
        location: "America",
        trends: trends,
        count: trends.length,
      },
    });
  } catch (error) {
    console.error("Error generating real estate trends:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate real estate trends",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getCityBasedTrends = async (req: Request, res: Response) => {
  try {
    const { city, count = 10, fast = false, super_fast = false } = req.body;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City is required in request body",
      });
    }

    // Validate count parameter
    let validCount = Math.min(Math.max(parseInt(count) || 10, 1), 20);

    // Super fast mode: max 3 trends, uses templates only
    if (super_fast) {
      validCount = Math.min(validCount, 3);
    }
    // Fast mode: max 5 trends, uses templates for small counts
    else if (fast) {
      validCount = Math.min(validCount, 5);
    }

    console.log(
      `Generating real estate trends for ${city} (${validCount} trends, fast: ${fast}, super_fast: ${super_fast})...`
    );

    const startTime = Date.now();
    const trends = await generateCityBasedTrends(city, validCount);
    const endTime = Date.now();

    res.status(200).json({
      success: true,
      message: `Real estate trends for ${city} generated successfully`,
      data: {
        topic: "real_estate",
        location: city,
        trends: trends,
        count: trends.length,
        city: city,
        processing_time_ms: endTime - startTime,
        cached: trends.length > 0 ? "Cache hit" : "Fresh generation",
        fast_mode: fast,
        super_fast_mode: super_fast,
        generation_method: validCount <= 5 ? "Template-based" : "AI-generated",
      },
    });
  } catch (error) {
    console.error(`Error generating trends for ${req.body.city}:`, error);

    res.status(500).json({
      success: false,
      message: `Failed to generate real estate trends for ${req.body.city}`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const generateContentFromDescription = async (
  req: Request,
  res: Response
) => {
  try {
    const { description, city } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Description is required in request body",
      });
    }

    console.log(
      `Generating content from description${city ? ` for ${city}` : ""}...`
    );

    const startTime = Date.now();
    const content = await generateFromDescription(description, city);
    const endTime = Date.now();

    res.status(200).json({
      success: true,
      message: "Content generated successfully from description",
      data: {
        ...content,
        processing_time_ms: endTime - startTime,
        city: city || null,
        generation_method: "AI-generated",
      },
    });
  } catch (error) {
    console.error(`Error generating content from description:`, error);

    res.status(500).json({
      success: false,
      message: "Failed to generate content from description",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
