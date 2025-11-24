/**
 * Trends service for generating real estate trends and content
 */

import { TrendData } from "../types/services/trends.types";
import {
  getCachedTrends,
  setCachedTrends,
  generateCacheKey,
} from "../utils/trendsCache";
import {
  extractJsonFromText,
  buildCityContext,
  ensureMinimumKeypoints,
  normalizeKeypoints,
  validateWithKeywords,
  isContentModerationError,
  isValidationError,
  formatContentModerationError,
} from "../utils/trendsHelpers";
import {
  getPositionTemplates,
  generateTrendsFromTemplates,
  generateFallbackTrends,
} from "../utils/trendsTemplates";
import {
  checkContentSafetyWithOpenAI,
  validateRealEstateDescriptionWithOpenAI,
  makeOpenAIRequest,
} from "../utils/openaiHelpers";
import {
  buildValidationPrompt,
  buildDescriptionGenerationPrompt,
  buildDescriptionSystemMessage,
  buildCityBasedTrendsPrompt,
  buildCityBasedTrendsSystemMessage,
  buildRealEstateTrendsPrompt,
  buildRealEstateTrendsSystemMessage,
} from "../prompts/trends.prompts";
import { getCityData } from "../utils/trendsHelpers";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Generate keypoints and captions from a description
 */
export async function generateFromDescription(
  description: string,
  city?: string
): Promise<TrendData> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // Check content safety first
    const safetyCheck = await checkContentSafetyWithOpenAI(description);
    if (!safetyCheck.isSafe) {
      const errorObj = formatContentModerationError(safetyCheck.category || "inappropriate");
      throw new Error(errorObj.error || errorObj.message);
    }

    // Validate real estate related
    let isRealEstateRelated = false;
    try {
      const validationPrompt = buildValidationPrompt(description);
      isRealEstateRelated = await validateRealEstateDescriptionWithOpenAI(
        description,
        validationPrompt
      );
    } catch (validationError: any) {
      // If validation throws a content moderation error, re-throw it
      if (isContentModerationError(validationError)) {
        throw validationError;
      }
      // Fallback to keyword validation
      isRealEstateRelated = validateWithKeywords(description);
    }

    // Build city context
    const cityInfo = city ? getCityData(city) : null;
    const cityContext = cityInfo && city
      ? buildCityContext(city)
      : isRealEstateRelated
      ? " for real estate"
      : "";

    // Build prompts
    const prompt = buildDescriptionGenerationPrompt(
      description,
      city,
      cityContext
    );
    const systemMessage = buildDescriptionSystemMessage(city);

    // Make OpenAI request
    const response = await makeOpenAIRequest(
      [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        max_tokens: 800,
        timeout: 30000,
      }
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("No content received from ChatGPT");
    }

    let parsed: any = extractJsonFromText(content);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Parsed response is not a valid object");
    }

    // Ensure minimum 3 keypoints
    const keypoints = ensureMinimumKeypoints(parsed.keypoints || "");

    return {
      description: description,
      keypoints: keypoints,
    };
  } catch (error: any) {
    // Re-throw validation errors and content moderation errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (isContentModerationError(errorMessage) || isValidationError(errorMessage)) {
      throw error;
    }

    // Return fallback content only for AI/processing errors
    return {
      description: description,
      keypoints: "Property features, Location benefits, Investment potential",
    };
  }
}

/**
 * Generate city-based trends
 */
export async function generateCityBasedTrends(
  city: string,
  position: string,
  count: number = 10,
  retryCount = 0,
  seed: number = 0
): Promise<TrendData[]> {
  try {
    // Check cache first
    const cacheKey = generateCacheKey(city, position, count);
    const cached = getCachedTrends(cacheKey);
    if (cached) {
      return cached;
    }

    // For fast mode or small counts, use template-based generation
    if (count <= 5) {
      const templates = getPositionTemplates(city, position);
      const trends = generateTrendsFromTemplates(templates, count);
      setCachedTrends(cacheKey, trends);
      return trends;
    }

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // Build prompts
    const prompt = buildCityBasedTrendsPrompt(city, position, count, seed);
    const systemMessage = buildCityBasedTrendsSystemMessage(city, position);

    // Make OpenAI request
    const response = await makeOpenAIRequest(
      [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        max_tokens: Math.max(2000, count * 300),
        timeout: 60000,
      }
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("No content received from ChatGPT");
    }

    let parsed: any = extractJsonFromText(content);

    if (!Array.isArray(parsed)) {
      throw new Error("Parsed response is not an array");
    }

    // Handle count mismatch gracefully
    if (parsed.length !== count) {
      // If we got fewer than requested, pad with generated trends
      if (parsed.length < count) {
        const missing = count - parsed.length;
        for (let i = 0; i < missing; i++) {
          parsed.push({
            description: `${city} Real Estate Trend ${i + 1}`,
            keypoints: "Market insights, Expert guidance, Local expertise",
          });
        }
      } else {
        // If we got more than requested, trim to requested count
        parsed = parsed.slice(0, count);
      }
    }

    // Map and validate trends
    const mappedTrends = parsed.map((item: any) => {
      const keypoints = ensureMinimumKeypoints(normalizeKeypoints(item.keypoints));
      return {
        description: item.description || "",
        keypoints: keypoints,
      };
    });

    // Cache the results
    setCachedTrends(cacheKey, mappedTrends);

    return mappedTrends;
  } catch (error) {
    if (retryCount < 1) {
      return await generateCityBasedTrends(
        city,
        position,
        count,
        retryCount + 1,
        seed
      );
    }

    return generateFallbackTrends(city, count);
  }
}

/**
 * Generate general real estate trends
 */
export async function generateRealEstateTrends(
  count: number = 10,
  retryCount = 0,
  seed: number = 0
): Promise<TrendData[]> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // Build prompts
    const prompt = buildRealEstateTrendsPrompt(count, seed);
    const systemMessage = buildRealEstateTrendsSystemMessage();

    // Make OpenAI request
    const response = await makeOpenAIRequest(
      [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        max_tokens: Math.max(2000, count * 300),
        timeout: 90000,
      }
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("No content received from ChatGPT");
    }

    let parsed: any = extractJsonFromText(content);

    if (!Array.isArray(parsed)) {
      throw new Error("Parsed response is not an array");
    }

    // Ensure we have exactly the requested number of items
    if (parsed.length !== count) {
      throw new Error(
        `Expected exactly ${count} trends, but received ${parsed.length}`
      );
    }

    const mappedTrends = parsed.map((item: any) => ({
      description: item.description || "",
      keypoints: normalizeKeypoints(item.keypoints),
    }));

    return mappedTrends;
  } catch (error) {
    if (retryCount < 1) {
      return await generateRealEstateTrends(count, retryCount + 1, seed);
    }

    return [];
  }
}
