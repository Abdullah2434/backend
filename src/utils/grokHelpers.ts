/**
 * Grok API helper functions
 */

import axios from "axios";

const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const GROK_API_KEY = process.env.GROK_API_KEY;

interface GrokMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface GrokResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Call Grok API with a prompt
 */
export async function callGrokAPI(prompt: string): Promise<string> {
  if (!GROK_API_KEY) {
    throw new Error("GROK_API_KEY environment variable is not set");
  }

  const messages: GrokMessage[] = [
    {
      role: "user",
      content: prompt,
    },
  ];

  try {
    const response = await axios.post<GrokResponse>(
      GROK_API_URL,
      {
        model: "grok-3",
        messages,
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROK_API_KEY}`,
        },
        timeout: 30000, // 30 seconds timeout
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content received from Grok API");
    }

    return content;
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Grok API error: ${error.response.status} ${error.response.statusText}`
      );
    }
    throw new Error(`Failed to call Grok API: ${error.message}`);
  }
}

/**
 * Parse track names from Grok's response
 * Handles both JSON format and plain text format
 */
export function parseTrackNamesFromGrok(grokResponse: string): string[] {
  const trackNames: string[] = [];

  try {
    // Try to parse as JSON first
    const jsonMatch = grokResponse.match(/\[.*?\]/s);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === "string") return item.trim();
            if (typeof item === "object" && item.name) return item.name.trim();
            return null;
          })
          .filter((name): name is string => name !== null && name.length > 0);
      }
    }

    // Try to extract from numbered list or bullet points
    const lines = grokResponse.split("\n");
    for (const line of lines) {
      // Match patterns like "1. Track Name", "- Track Name", "* Track Name"
      const match = line.match(/^[\d\-\*\.\s]+(.+)$/);
      if (match) {
        const trackName = match[1].trim();
        if (trackName && trackName.length > 0) {
          trackNames.push(trackName);
        }
      }
    }

    // If we found track names, return them
    if (trackNames.length > 0) {
      return trackNames;
    }

    // Fallback: try to extract quoted strings
    const quotedMatches = grokResponse.match(/"([^"]+)"/g);
    if (quotedMatches) {
      return quotedMatches
        .map((match) => match.replace(/"/g, "").trim())
        .filter((name) => name.length > 0);
    }

    // Last resort: split by common delimiters and take non-empty lines
    const fallbackNames = grokResponse
      .split(/[,\n]/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0 && name.length < 200); // Reasonable track name length

    return fallbackNames.slice(0, 10); // Limit to 10
  } catch (error) {
    console.error("Error parsing track names from Grok response:", error);
    // Return empty array if parsing fails
    return [];
  }
}

/**
 * Generate prompt for Grok to search trending tracks
 */
export function generateGrokPrompt(city: string): string {
  return `Search https://www.jamendo.com/start?filter=trending and find 10 trending track names from Jamendo for ${city}. 

Please provide the track names as a JSON array of strings, like this:
["Track Name 1", "Track Name 2", "Track Name 3", ...]

Only return the track names, nothing else. Make sure the track names are exact as they appear on Jamendo.`;
}

