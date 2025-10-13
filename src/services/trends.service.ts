// language: typescript
// filepath: /Users/mac/Desktop/edge-all/backend/src/services/trends.service.ts

import axios from "axios";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface TrendData {
  description: string;
  keypoints: string;
  instagram_caption: string;
  facebook_caption: string;
  linkedin_caption: string;
  twitter_caption: string;
  tiktok_caption: string;
  youtube_caption: string;
}

/**
 * Utility to robustly extract JSON from raw text responses,
 * including handling truncated arrays/objects and malformed JSON.
 */
function extractJsonFromText(content: string): any {
  if (!content || typeof content !== "string") {
    throw new Error("No content to parse");
  }

  // Remove markdown fences
  let cleaned = content
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  // Extract only the JSON portion (between first {/[ and last }/])
  const firstIdx = Math.min(
    ...["{", "["].map((ch) =>
      cleaned.indexOf(ch) === -1
        ? Number.POSITIVE_INFINITY
        : cleaned.indexOf(ch)
    )
  );
  const lastIdx = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (!isFinite(firstIdx) || lastIdx === -1) {
    throw new Error("No JSON object/array found in content");
  }

  let candidate = cleaned.slice(firstIdx, lastIdx + 1).trim();

  // Fix common JSON issues
  let candidateFixed = candidate
    .replace(/,\s*(?=[}\]])/g, "") // remove trailing commas
    .replace(/\n/g, " ") // replace newlines with spaces
    .replace(/\s+/g, " ") // normalize whitespace
    .trim();

  try {
    return JSON.parse(candidateFixed);
  } catch (err) {
    console.warn("Parse failed, attempting auto-repair...");
    console.log("Original candidate:", candidate);
    console.log("Fixed candidate:", candidateFixed);
    console.log("Parse error:", err);

    // Try parsing the original candidate first (before any modifications)
    try {
      return JSON.parse(candidate);
    } catch (err2) {
      console.warn(
        "Original candidate also failed, trying more aggressive fixes..."
      );
    }

    // If array opened but not closed
    if (candidateFixed.startsWith("[") && !candidateFixed.endsWith("]")) {
      // Find the last complete object in the array
      const lastCompleteObject = candidateFixed.lastIndexOf("}");
      if (lastCompleteObject > 0) {
        candidateFixed =
          candidateFixed.substring(0, lastCompleteObject + 1) + "]";
      } else {
        candidateFixed += "]";
      }
    }

    // If object opened but not closed
    if (candidateFixed.startsWith("{") && !candidateFixed.endsWith("}")) {
      candidateFixed += "}";
    }

    try {
      return JSON.parse(candidateFixed);
    } catch (err2) {
      // Try trimming to last complete object/array
      const lastValidIdx = Math.max(
        candidateFixed.lastIndexOf("}"),
        candidateFixed.lastIndexOf("]")
      );
      if (lastValidIdx > 0) {
        const trimmed = candidateFixed.slice(0, lastValidIdx + 1);
        try {
          return JSON.parse(trimmed);
        } catch (err3) {
          console.error("Final JSON parse failed. Returning empty array.");
          console.error("Raw response:\n", content);
          console.error("Candidate after fixes:\n", candidateFixed);
          return [];
        }
      }

      console.error("No valid JSON found at all. Returning empty array.");
      console.error("Raw response:\n", content);
      return [];
    }
  }
}

export async function generateRealEstateTrends(
  count: number = 10,
  retryCount = 0,
  seed: number = 0
): Promise<TrendData[]> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const prompt = `
Generate ${count} current topic trends for creating video ads about real estate in America (batch ${
      seed + 1
    }).  
Each trend should highlight a unique aspect of the real estate industry that's ideal for engaging video advertising.
Focus on different real estate topics and avoid repeating common themes like smart homes, virtual tours, etc. from previous batches.  

For each trend, include:
1. A short, catchy description (5–6 words max)
2. Key points (no more than 5 words)
3. Platform-specific captions:
   - Instagram: engaging, emoji-rich, 1–2 sentences  
   - Facebook: informative, 2–3 sentences  
   - LinkedIn: professional, 2–3 sentences  
   - Twitter: concise, hashtag-friendly, 1–2 sentences  
   - TikTok: trendy, engaging, 1–2 sentences  
   - YouTube: descriptive, SEO-friendly, 2–3 sentences  

Return your result as a valid JSON array like this:
[
  {
    "description": "",
    "keypoints": "",
    "instagram_caption": "",
    "facebook_caption": "",
    "linkedin_caption": "",
    "twitter_caption": "",
    "tiktok_caption": "",
    "youtube_caption": ""
  }
]
Ensure all fields are filled and formatted as strings.
`;

    const response = await axios.post<OpenAIResponse>(
      OPENAI_API_URL,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a real estate marketing strategist and video content expert. Provide concise, clear, and engaging trend ideas suitable for multiple social platforms.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: Math.max(2000, count * 300),
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 90000,
      }
    );

    const content = response.data.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("No content received from ChatGPT");
    }

    let parsed: any = extractJsonFromText(content);

    if (!Array.isArray(parsed)) {
      throw new Error("Parsed response is not an array");
    }

    const mappedTrends = parsed.map((item: any) => ({
      description: item.description || "",
      keypoints: Array.isArray(item.keypoints)
        ? item.keypoints.join(", ")
        : item.keypoints || "",
      instagram_caption: item.instagram_caption || "",
      facebook_caption: item.facebook_caption || "",
      linkedin_caption: item.linkedin_caption || "",
      twitter_caption: item.twitter_caption || "",
      tiktok_caption: item.tiktok_caption || "",
      youtube_caption: item.youtube_caption || "",
    }));

    // Log if we got fewer trends than requested
    if (mappedTrends.length < count) {
      console.warn(
        `⚠️ Requested ${count} trends but got ${mappedTrends.length} trends`
      );
    }

    return mappedTrends;
  } catch (error) {
    if (retryCount < 1) {
      console.warn("First attempt failed, retrying once...");
      return await generateRealEstateTrends(count, retryCount + 1, seed);
    }
    console.error("Error generating real estate trends:", error);
    return [];
  }
}
