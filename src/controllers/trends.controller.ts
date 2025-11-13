import { Request, Response } from "express";
import {
  generateRealEstateTrends,
  generateCityBasedTrends,
  generateFromDescription,
} from "../services/trends.service";

export const getRealEstateTrends = async (req: Request, res: Response) => {
  try {
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
    res.status(500).json({
      success: false,
      message: "Failed to generate real estate trends",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getCityBasedTrends = async (req: Request, res: Response) => {
  try {
    const {
      city,
      position,
      count = 10,
      fast = false,
      super_fast = false,
    } = req.body;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City is required in request body",
      });
    }

    if (!position) {
      return res.status(400).json({
        success: false,
        message: "Position is required in request body",
      });
    }

    // Normalize position for consistent handling
    const normalizedPosition = String(position).trim();
    const normalizedCity = String(city).trim();
    let validCount = Math.min(Math.max(parseInt(count) || 10, 1), 20);

    // Super fast mode: max 3 trends, uses templates only
    if (super_fast) {
      validCount = Math.min(validCount, 3);
    }
    // Fast mode: max 5 trends, uses templates for small counts
    else if (fast) {
      validCount = Math.min(validCount, 5);
    }
    const startTime = Date.now();
    const trends = await generateCityBasedTrends(
      normalizedCity,
      normalizedPosition,
      validCount
    );
    const endTime = Date.now();

    res.status(200).json({
      success: true,
      message: `Real estate trends for ${city} (${position}) generated successfully`,
      data: {
        topic: "real_estate",
        location: city,
        position: position,
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
    res.status(500).json({
      success: false,
      message: `Failed to generate real estate trends for ${req.body.city} (${req.body.position})`,
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

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isContentModerationError =
      errorMessage.includes("CONTENT_MODERATION_ERROR") ||
      errorMessage.includes("inappropriate") ||
      errorMessage.includes("racism") ||
      errorMessage.includes("nudity") ||
      errorMessage.includes("vulgar");
    const isValidationError =
      errorMessage.includes("VALIDATION_ERROR") ||
      errorMessage.includes("not related to real estate") ||
      errorMessage.includes("not real estate related");

    // Handle content moderation errors
    if (isContentModerationError) {
      return res.status(400).json({
        success: false,
        message: "Content contains inappropriate material",
        error: errorMessage,
        details: {
          restriction: "Content must be free of racism, nudity, and vulgar language",
          requirement: "Please use professional and respectful language appropriate for a real estate platform",
          categories: {
            "Racism": "Content must not contain racist, discriminatory, or hate speech",
            "Nudity": "Content must not contain sexual or explicit content",
            "Vulgar": "Content must not contain profanity or offensive language",
          },
          message: "Please revise your content to remove any inappropriate material and try again.",
        },
      });
    }

    // Handle validation errors (description not real estate related)
    if (isValidationError) {
      return res.status(400).json({
        success: false,
        message: `Description must be related to real estate topics.`,
        error: errorMessage,
        details: {
          requirement:
            "The provided description must be related to one or more of the following categories:",
          categories: {
            "1. Real Estate": {
              definition:
                "Properties, homes, houses, apartments, condos, townhouses, commercial real estate, real estate market, property listings",
              examples: [
                "Luxury homes in Beverly Hills",
                "Commercial properties for sale",
                "Real estate investment opportunities",
              ],
            },
            "2. Property": {
              definition:
                "Buying, selling, renting, investing in properties, property management, property values, property transactions",
              examples: [
                "Buying your first home",
                "Investment properties for sale",
                "Property rental income",
              ],
            },
            "3. Housing": {
              definition:
                "Residential properties, housing market, homeownership, rental properties, housing trends, affordable housing",
              examples: [
                "First-time homebuyer programs",
                "Housing market trends",
                "Affordable housing options",
              ],
            },
            "4. Mortgages/Loans": {
              definition:
                "Mortgage loans, refinancing, home financing, loan products, interest rates, down payments, loan approval",
              examples: [
                "VA loan benefits",
                "Mortgage refinancing options",
                "FHA loan programs",
              ],
            },
            "5. Real Estate Professionals": {
              definition:
                "Real estate agents, brokers, loan officers, mortgage brokers, realtors, real estate services",
              examples: [
                "Find a real estate agent",
                "Loan officer services",
                "Real estate broker expertise",
              ],
            },
          },
          message:
            "Please provide a description that relates to any of these categories to generate keypoints.",
        },
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to generate content from description",
      error: errorMessage,
    });
  }
};
