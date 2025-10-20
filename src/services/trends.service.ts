// language: typescript
// filepath: /Users/mac/Desktop/edge-all/backend/src/services/trends.service.ts

import axios from "axios";
import GrokGenerationService from "./grokGeneration.service";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface TrendData {
  description: string;
  keypoints: string;
  instagram_caption: string;
  facebook_caption: string;
  linkedin_caption: string;
  twitter_caption: string;
  tiktok_caption: string;
  youtube_caption: string;
}

function extractJsonFromText(content: string): any {
  try {
    // First, try to parse the entire content as JSON
    return JSON.parse(content);
  } catch {
    // If that fails, try to extract JSON from the text
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        console.error("Failed to parse extracted JSON");
        return null;
      }
    }

    // If no array found, try to find object patterns
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        console.error("Failed to parse extracted object");
        return null;
      }
    }

    console.error("No valid JSON found in content");
    console.error("Raw response:\n", content);
    return [];
  }
}

export async function generateRealEstateTrends(
  count: number = 10,
  retryCount = 0,
  seed: number = 0,
  userId?: string
): Promise<TrendData[]> {
  try {
    // Use Grok for trending, current topics with user history
    let userHistory: string[] = [];
    if (userId) {
      userHistory = await GrokGenerationService.getUserTopicHistory(userId, 10);
    }

    console.log(
      `🚀 Generating ${count} trending real estate topics using Grok (batch ${
        seed + 1
      })`
    );
    console.log(
      `📊 User history topics: ${userHistory.length} previous topics`
    );

    const trends = await GrokGenerationService.generateRealEstateTrends(
      count,
      retryCount,
      seed,
      userHistory
    );

    console.log(`✅ Generated ${trends.length} trending topics using Grok`);
    return trends;
  } catch (error: any) {
    console.error("Error generating trends with Grok:", error);

    if (retryCount < 2) {
      console.log(`Retrying trend generation (attempt ${retryCount + 1})...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return generateRealEstateTrends(count, retryCount + 1, seed, userId);
    }

    // Fallback to basic trends
    console.log("Using fallback trends due to Grok failure");
    return [
      {
        description: "Market Update Today",
        keypoints: "Current rates, prices, trends",
        instagram_caption:
          "📈 Today's real estate market update! Current trends and what it means for you 🏠 #RealEstate #MarketUpdate",
        facebook_caption:
          "Real estate market update for today. Here's what's happening with rates, prices, and trends in your area.",
        linkedin_caption:
          "Professional analysis of today's real estate market conditions and trends affecting buyers and sellers.",
        twitter_caption:
          "Today's real estate market update 📈 #RealEstate #MarketTrends",
        tiktok_caption:
          "Today's market update 📈 #RealEstate #MarketTrends #fyp",
        youtube_caption:
          "Real Estate Market Update - Today's Analysis of Current Trends, Rates, and Market Conditions",
      },
    ].slice(0, count);
  }
}

// Fallback OpenAI function (kept for emergency use)
export async function generateRealEstateTrendsOpenAI(
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

    console.log(
      `✅ Generated ${mappedTrends.length} real estate trends using OpenAI fallback`
    );
    return mappedTrends;
  } catch (error: any) {
    console.error("Error generating trends with OpenAI fallback:", error);

    if (retryCount < 2) {
      console.log(
        `Retrying OpenAI trend generation (attempt ${retryCount + 1})...`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return generateRealEstateTrendsOpenAI(count, retryCount + 1, seed);
    }

    console.error("Failed to generate trends after retries");
    return [];
  }
}
