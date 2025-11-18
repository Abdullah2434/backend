/**
 * OpenAI API helper functions
 */

import axios from "axios";
import {
  OpenAIResponse,
  ContentSafetyResult,
} from "../types/services/trends.types";
import {
  OPENAI_API_URL,
  OPENAI_MODERATION_URL,
} from "../constants/trends.constants";
import {
  checkInappropriateContent,
  processModerationResult,
  extractJsonFromText,
} from "./trendsHelpers";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Make OpenAI API request
 */
export async function makeOpenAIRequest(
  messages: any[],
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    timeout?: number;
  } = {}
): Promise<OpenAIResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const {
    model = "gpt-3.5-turbo",
    temperature = 0.7,
    max_tokens = 800,
    timeout = 30000,
  } = options;

  const response = await axios.post<OpenAIResponse>(
    OPENAI_API_URL,
    {
      model,
      messages,
      temperature,
      max_tokens,
      stream: false,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      timeout,
    }
  );

  return response.data;
}

/**
 * Check content safety using OpenAI Moderation API
 */
export async function checkContentSafetyWithOpenAI(
  content: string
): Promise<ContentSafetyResult> {
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return { isSafe: true }; // Empty content is safe
  }

  // First check with keyword patterns
  const keywordCheck = checkInappropriateContent(content);
  if (keywordCheck) {
    return keywordCheck;
  }

  // Use OpenAI Moderation API if available
  if (!OPENAI_API_KEY) {
    return { isSafe: true }; // If no API key, assume safe after keyword check
  }

  try {
    const moderationResponse = await axios.post(
      OPENAI_MODERATION_URL,
      {
        input: content,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 10000,
      }
    );

    const moderationResult = moderationResponse.data?.results?.[0];
    const moderationCheck = processModerationResult(moderationResult);

    if (moderationCheck) {
      return moderationCheck;
    }

    // Content passed OpenAI moderation
    return { isSafe: true };
  } catch (moderationError: any) {
    // Fall through to return safe if keyword check passed
    return { isSafe: true };
  }
}

/**
 * Validate real estate description using OpenAI
 */
export async function validateRealEstateDescriptionWithOpenAI(
  description: string,
  validationPrompt: string
): Promise<boolean> {
  if (!OPENAI_API_KEY) {
    return false; // Cannot validate without API key
  }

  try {
    const response = await makeOpenAIRequest(
      [
        {
          role: "system",
          content:
            "You are a validation expert. Analyze descriptions and determine if they are real estate related. Return only valid JSON format.",
        },
        {
          role: "user",
          content: validationPrompt,
        },
      ],
      {
        model: "gpt-3.5-turbo",
        temperature: 0.3, // Lower temperature for more consistent validation
        max_tokens: 200,
        timeout: 15000,
      }
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return false;
    }

    const parsed: any = extractJsonFromText(content);

    if (parsed && typeof parsed.isRealEstateRelated === "boolean") {
      return parsed.isRealEstateRelated;
    }

    return false;
  } catch (error: any) {
    // Re-throw content moderation errors
    if (error.message?.includes("CONTENT_MODERATION_ERROR")) {
      throw error;
    }
    return false;
  }
}
