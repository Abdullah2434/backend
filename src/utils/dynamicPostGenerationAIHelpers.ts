/**
 * AI-related helper functions for dynamic post generation
 */

import OpenAI from "openai";
import {
  OPENAI_MODEL,
  OPENAI_TEMPERATURE,
  OPENAI_MAX_TOKENS,
} from "../constants/dynamicPostGeneration.constants";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate content using OpenAI
 */
export async function generateContentWithOpenAI(
  prompt: string,
  systemMessage: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: OPENAI_TEMPERATURE,
      max_tokens: OPENAI_MAX_TOKENS,
    });

    const aiResponse = response.choices[0].message.content || "";
    return aiResponse;
  } catch (error) {
    throw new Error("Failed to generate content with AI");
  }
}

