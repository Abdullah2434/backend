// language: typescript
// filepath: /Users/mac/Desktop/edge-all/backend/src/services/trends.service.ts

import axios from "axios";

// Simple in-memory cache for trends
const trendsCache = new Map<string, { data: TrendData[]; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache

// City-specific real estate data for more accurate trends
const cityData: Record<string, any> = {
  "New York": {
    neighborhoods: [
      "Manhattan",
      "Brooklyn",
      "Queens",
      "Bronx",
      "Staten Island",
    ],
    priceRange: "$500K - $5M+",
    marketTrend: "Competitive market with high demand",
    keyFeatures: ["Skyline views", "Historic buildings", "Modern amenities"],
    popularAreas: ["SoHo", "Tribeca", "Upper East Side", "Williamsburg"],
  },
  "Los Angeles": {
    neighborhoods: [
      "Beverly Hills",
      "Hollywood",
      "Santa Monica",
      "Venice",
      "Malibu",
    ],
    priceRange: "$400K - $10M+",
    marketTrend: "Entertainment industry hub with luxury properties",
    keyFeatures: ["Pool homes", "Hillside views", "Celebrity neighborhoods"],
    popularAreas: ["Beverly Hills", "Hollywood Hills", "Malibu", "Venice"],
  },
  Miami: {
    neighborhoods: [
      "South Beach",
      "Brickell",
      "Coconut Grove",
      "Aventura",
      "Key Biscayne",
    ],
    priceRange: "$300K - $15M+",
    marketTrend: "International buyers and luxury waterfront",
    keyFeatures: ["Waterfront properties", "Art Deco", "High-rise condos"],
    popularAreas: ["South Beach", "Brickell", "Coconut Grove", "Aventura"],
  },
  Chicago: {
    neighborhoods: [
      "Gold Coast",
      "Lincoln Park",
      "Lakeview",
      "Wicker Park",
      "River North",
    ],
    priceRange: "$200K - $3M+",
    marketTrend: "Strong downtown market with historic architecture",
    keyFeatures: [
      "Historic buildings",
      "Lake Michigan views",
      "Modern high-rises",
    ],
    popularAreas: ["Gold Coast", "Lincoln Park", "River North", "Wicker Park"],
  },
  "San Francisco": {
    neighborhoods: [
      "Pacific Heights",
      "Mission District",
      "SOMA",
      "Castro",
      "Marina",
    ],
    priceRange: "$800K - $8M+",
    marketTrend: "Tech industry driving high prices",
    keyFeatures: ["Victorian homes", "Tech proximity", "Bay views"],
    popularAreas: ["Pacific Heights", "Mission District", "SOMA", "Castro"],
  },
};

// Fallback trends generator with city-specific data
function generateFallbackTrends(city: string, count: number): TrendData[] {
  const cityInfo = cityData[city] || {
    neighborhoods: ["Downtown", "Suburbs", "Waterfront"],
    priceRange: "$200K - $2M+",
    marketTrend: "Growing real estate market",
    keyFeatures: ["Modern amenities", "Good location"],
    popularAreas: ["Downtown", "Suburbs"],
  };

  const fallbackTrends = [
    {
      description: `${city} Luxury Homes`,
      keypoints: `High-end properties in ${cityInfo.neighborhoods[0]}`,
      instagram_caption: "",
      facebook_caption: "",
      linkedin_caption: "",
      twitter_caption: "",
      tiktok_caption: "",
      youtube_caption: "",
    },
    {
      description: `${city} Investment Properties`,
      keypoints: "Rental income, appreciation potential",
      instagram_caption: "",
      facebook_caption: "",
      linkedin_caption: "",
      twitter_caption: "",
      tiktok_caption: "",
      youtube_caption: "",
    },
    {
      description: `${city} First-Time Buyers`,
      keypoints: "Affordable options, starter homes",
      instagram_caption: "",
      facebook_caption: "",
      linkedin_caption: "",
      twitter_caption: "",
      tiktok_caption: "",
      youtube_caption: "",
    },
    {
      description: `${city} Market Trends`,
      keypoints: "Price growth, market insights",
      instagram_caption: "",
      facebook_caption: "",
      linkedin_caption: "",
      twitter_caption: "",
      tiktok_caption: "",
      youtube_caption: "",
    },
    {
      description: `${city} New Developments`,
      keypoints: "Modern amenities, new construction",
      instagram_caption: `🏗️ New developments in ${city}! #${city.replace(
        /\s+/g,
        ""
      )}RealEstate #NewConstruction`,
      facebook_caption: `Explore new residential developments in ${city} with modern amenities and contemporary design.`,
      linkedin_caption: `${city} new construction projects offer modern living with cutting-edge amenities and design.`,
      twitter_caption: `🏗️ New ${city} developments! #${city.replace(
        /\s+/g,
        ""
      )}RealEstate #NewConstruction`,
      tiktok_caption: `🏗️ ${city} new builds! #${city.replace(
        /\s+/g,
        ""
      )}RealEstate #NewConstruction`,
      youtube_caption: `Discover new residential developments in ${city} featuring modern amenities and contemporary living.`,
    },
  ];

  // Return requested number of trends, cycling through fallback options
  const result: TrendData[] = [];
  for (let i = 0; i < count; i++) {
    const trendIndex = i % fallbackTrends.length;
    const trend = fallbackTrends[trendIndex];
    result.push({
      ...trend,
      description: trend.description.replace(/Trend \d+/, `Trend ${i + 1}`),
    });
  }

  return result;
}

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
}

/**
 * Utility to robustly extract JSON from raw text responses,
 * including handling truncated arrays/objects and malformed JSON.
 */
function extractJsonFromText(content: string): any {
  if (!content || typeof content !== "string") {
    throw new Error("No content to parse");
  }

  // Remove markdown fences and clean up
  let cleaned = content
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/\n\s*\n/g, "\n") // Remove empty lines
    .trim();

  // Try to find JSON array first
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    cleaned = arrayMatch[0];
  } else {
    // Extract only the JSON portion (between first {/[ and last }/])
    const firstIdx = Math.min(
      ...["{", "["].map((ch) =>
        cleaned.indexOf(ch) === -1
          ? Number.POSITIVE_INFINITY
          : cleaned.indexOf(ch)
      )
    );
    const lastIdx = Math.max(
      cleaned.lastIndexOf("}"),
      cleaned.lastIndexOf("]")
    );
    if (!isFinite(firstIdx) || lastIdx === -1) {
      throw new Error("No JSON object/array found in content");
    }
    cleaned = cleaned.slice(firstIdx, lastIdx + 1).trim();
  }

  // Fix common JSON issues
  let candidateFixed = cleaned
    .replace(/,\s*(?=[}\]])/g, "") // remove trailing commas
    .replace(/\n/g, " ") // replace newlines with spaces
    .replace(/\s+/g, " ") // normalize whitespace
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // quote unquoted keys
    .trim();

  try {
    return JSON.parse(candidateFixed);
  } catch (err) {
    console.warn("Parse failed, attempting auto-repair...");
    console.log("Original content:", content.substring(0, 200) + "...");
    console.log(
      "Parse error:",
      err instanceof Error ? err.message : String(err)
    );

    // Try parsing the original candidate first
    try {
      return JSON.parse(cleaned);
    } catch (err2) {
      console.warn(
        "Original candidate also failed, trying more aggressive fixes..."
      );
    }

    // If array opened but not closed
    if (candidateFixed.startsWith("[") && !candidateFixed.endsWith("]")) {
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
          return [];
        }
      }

      console.error("No valid JSON found at all. Returning empty array.");
      return [];
    }
  }
}

// Ultra-fast template-based generation (2-3 seconds)
function generateFastTrends(city: string, count: number): TrendData[] {
  const cityInfo = cityData[city] || {
    neighborhoods: ["Downtown", "Suburbs", "Waterfront"],
    priceRange: "$200K - $2M+",
    marketTrend: "Growing real estate market",
    keyFeatures: ["Modern amenities", "Good location"],
    popularAreas: ["Downtown", "Suburbs"],
  };

  const templates = [
    {
      description: `${city} Luxury Homes`,
      keypoints: `High-end properties in ${cityInfo.neighborhoods[0]}`,
      instagram_caption: "",
      facebook_caption: "",
      linkedin_caption: "",
      twitter_caption: "",
      tiktok_caption: "",
      youtube_caption: "",
    },
    {
      description: `${city} Investment Properties`,
      keypoints: `Rental income in ${cityInfo.neighborhoods[1]}`,
      instagram_caption: `💰 ${city} investment properties! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #Investment`,
      facebook_caption: `Invest in ${city} real estate for strong rental income. ${cityInfo.marketTrend} with properties in ${cityInfo.popularAreas[1]}.`,
      linkedin_caption: `${city} real estate investment opportunities with strong rental yields. ${cityInfo.marketTrend} in ${cityInfo.neighborhoods[1]}.`,
      twitter_caption: `💰 ${city} investment properties! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #Investment`,
      tiktok_caption: `💰 ${city} investments! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #Investment`,
      youtube_caption: `Maximize your returns with ${city} real estate investments. ${cityInfo.marketTrend} with strong rental income potential.`,
    },
    {
      description: `${city} First-Time Buyers`,
      keypoints: `Affordable options in ${cityInfo.neighborhoods[2]}`,
      instagram_caption: `🏡 First-time buyer homes in ${city}! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #FirstTimeBuyer`,
      facebook_caption: `Find your first home in ${city} with our first-time buyer programs. ${cityInfo.marketTrend} with affordable options in ${cityInfo.popularAreas[2]}.`,
      linkedin_caption: `${city} offers excellent opportunities for first-time homebuyers. ${cityInfo.marketTrend} with various financing options in ${cityInfo.neighborhoods[2]}.`,
      twitter_caption: `🏡 First-time buyer homes in ${city}! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #FirstTimeBuyer`,
      tiktok_caption: `🏡 ${city} first homes! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #FirstTimeBuyer`,
      youtube_caption: `Start your homeownership journey in ${city} with our first-time buyer programs. ${cityInfo.marketTrend} with affordable housing options.`,
    },
    {
      description: `${city} Market Trends`,
      keypoints: `Price growth in ${cityInfo.neighborhoods[0]}`,
      instagram_caption: `📈 ${city} real estate trends! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #MarketTrends`,
      facebook_caption: `Stay updated with ${city} real estate market trends. ${cityInfo.marketTrend} with price movements in ${cityInfo.popularAreas[0]}.`,
      linkedin_caption: `${city} real estate market analysis shows strong growth trends. ${cityInfo.marketTrend} with investment potential in ${cityInfo.neighborhoods[0]}.`,
      twitter_caption: `📈 ${city} market trends! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #MarketTrends`,
      tiktok_caption: `📈 ${city} trends! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #MarketTrends`,
      youtube_caption: `Analyze ${city} real estate market trends and make informed investment decisions. ${cityInfo.marketTrend} with detailed market analysis.`,
    },
    {
      description: `${city} New Developments`,
      keypoints: `Modern amenities in ${cityInfo.neighborhoods[1]}`,
      instagram_caption: `🏗️ New developments in ${city}! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #NewConstruction`,
      facebook_caption: `Explore new residential developments in ${city} with modern amenities. ${cityInfo.marketTrend} with contemporary design in ${cityInfo.popularAreas[1]}.`,
      linkedin_caption: `${city} new construction projects offer modern living. ${cityInfo.marketTrend} with cutting-edge amenities in ${cityInfo.neighborhoods[1]}.`,
      twitter_caption: `🏗️ New ${city} developments! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #NewConstruction`,
      tiktok_caption: `🏗️ ${city} new builds! ${
        cityInfo.priceRange
      } #${city.replace(/\s+/g, "")}RealEstate #NewConstruction`,
      youtube_caption: `Discover new residential developments in ${city} featuring modern amenities. ${cityInfo.marketTrend} with contemporary living options.`,
    },
  ];

  // Generate requested number of trends
  const result: TrendData[] = [];
  for (let i = 0; i < count; i++) {
    const templateIndex = i % templates.length;
    const trend = templates[templateIndex];
    result.push({
      ...trend,
      description: trend.description.replace(/Trend \d+/, `Trend ${i + 1}`),
    });
  }

  return result;
}

// Generate keypoints and captions from a description
export async function generateFromDescription(
  description: string,
  city?: string
): Promise<TrendData> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const cityInfo = city ? cityData[city] : null;
    const cityContext = cityInfo
      ? ` for ${city} real estate market (${cityInfo.marketTrend}, ${cityInfo.priceRange})`
      : " for real estate";

    const prompt = `Based on this description: "${description}"

Generate keypoints and social media captions${cityContext}.

Return a JSON object with:
- keypoints: 3-5 key points (comma-separated)
- instagram_caption: engaging, emoji-rich, 1-2 sentences
- facebook_caption: informative, 2-3 sentences  
- linkedin_caption: professional, 2-3 sentences
- twitter_caption: concise, hashtag-friendly, 1-2 sentences
- tiktok_caption: trendy, engaging, 1-2 sentences
- youtube_caption: descriptive, SEO-friendly, 2-3 sentences

Return only valid JSON:
{
  "keypoints": "",
  "instagram_caption": "",
  "facebook_caption": "",
  "linkedin_caption": "",
  "twitter_caption": "",
  "tiktok_caption": "",
  "youtube_caption": ""
}`;

    const response = await axios.post<OpenAIResponse>(
      OPENAI_API_URL,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a real estate marketing expert${
              city ? ` specializing in ${city} real estate` : ""
            }. Generate engaging social media content from property descriptions. Return only valid JSON format.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
        stream: false,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("No content received from ChatGPT");
    }

    let parsed: any = extractJsonFromText(content);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Parsed response is not a valid object");
    }

    return {
      description: description,
      keypoints: parsed.keypoints || "",
    };
  } catch (error) {
    console.error(`Error generating content from description:`, error);

    // Return fallback content if AI fails
    return {
      description: description,
      keypoints: "Property features, Location benefits, Investment potential",
    };
  }
}

export async function generateCityBasedTrends(
  city: string,
  count: number = 10,
  retryCount = 0,
  seed: number = 0
): Promise<TrendData[]> {
  try {
    // Check cache first
    const cacheKey = `${city.toLowerCase()}_${count}`;
    const cached = trendsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Returning cached trends for ${city}`);
      return cached.data;
    }

    // For fast mode or small counts, use template-based generation
    if (count <= 5) {
      console.log(`Using fast template generation for ${city}`);
      const trends = generateFastTrends(city, count);

      // Cache the results
      trendsCache.set(cacheKey, {
        data: trends,
        timestamp: Date.now(),
      });

      return trends;
    }

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const prompt = `
Generate EXACTLY ${count} current topic trends for creating video ads about real estate in ${city} (batch ${
      seed + 1
    }). You MUST return exactly ${count} trends - no more, no less.
Each trend should highlight a unique aspect of the real estate industry specific to ${city} that's ideal for engaging video advertising.
Focus on local market conditions, city-specific amenities, neighborhood trends, and regional real estate opportunities in ${city}.  
Avoid generic trends and focus on what makes ${city} real estate unique.

CRITICAL: Return exactly ${count} items in the JSON array. Do not include any additional text, explanations, or comments outside the JSON array.

For each trend, include:
1. A short, catchy description (5–6 words max)
2. Key points (no more than 5 words)
3. NO platform-specific captions - these will be generated later with dynamic post generation  

Return your result as a valid JSON array with EXACTLY ${count} objects like this:
[
  {
    "description": "",
    "keypoints": ""
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
            content: `You are a real estate marketing strategist and video content expert specializing in ${city} real estate market. Provide concise, clear, and engaging trend ideas suitable for multiple social platforms. You MUST always return exactly the requested number of trends - no more, no less. Return only valid JSON array format with no additional text.`,
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
        timeout: 60000, // Reduced timeout for faster response
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

    // Handle count mismatch gracefully
    if (parsed.length !== count) {
      console.warn(
        `Expected ${count} trends but got ${parsed.length}. Adjusting to match request.`
      );

      // If we got fewer than requested, pad with generated trends
      if (parsed.length < count) {
        const missing = count - parsed.length;
        for (let i = 0; i < missing; i++) {
          parsed.push({
            description: `${city} Real Estate Trend ${i + 1}`,
            keypoints: "Market insights",
          });
        }
      } else {
        // If we got more than requested, trim to requested count
        parsed = parsed.slice(0, count);
      }
    }

    const mappedTrends = parsed.map((item: any) => ({
      description: item.description || "",
      keypoints: Array.isArray(item.keypoints)
        ? item.keypoints.join(", ")
        : item.keypoints || "",
    }));

    // Cache the results
    trendsCache.set(cacheKey, {
      data: mappedTrends,
      timestamp: Date.now(),
    });

    return mappedTrends;
  } catch (error) {
    if (retryCount < 1) {
      console.warn(`First attempt failed for ${city}, retrying once...`);
      return await generateCityBasedTrends(city, count, retryCount + 1, seed);
    }
    console.error(`Error generating trends for ${city}:`, error);

    // Return fallback trends if AI completely fails
    console.log(`Generating fallback trends for ${city}`);
    return generateFallbackTrends(city, count);
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
Generate EXACTLY ${count} current topic trends for creating video ads about real estate in America (batch ${
      seed + 1
    }). You MUST return exactly ${count} trends - no more, no less.
Each trend should highlight a unique aspect of the real estate industry that's ideal for engaging video advertising.
Focus on different real estate topics and avoid repeating common themes like smart homes, virtual tours, etc. from previous batches.  

CRITICAL: Return exactly ${count} items in the JSON array. Do not include any additional text, explanations, or comments outside the JSON array.

For each trend, include:
1. A short, catchy description (5–6 words max)
2. Key points (no more than 5 words)
3. NO platform-specific captions - these will be generated later with dynamic post generation  

Return your result as a valid JSON array with EXACTLY ${count} objects like this:
[
  {
    "description": "",
    "keypoints": ""
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
              "You are a real estate marketing strategist and video content expert. Provide concise, clear, and engaging trend ideas suitable for multiple social platforms. You MUST always return exactly the requested number of trends - no more, no less. Return only valid JSON array format with no additional text.",
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

    // Ensure we have exactly the requested number of items
    if (parsed.length !== count) {
      throw new Error(
        `Expected exactly ${count} trends, but received ${parsed.length}`
      );
    }

    const mappedTrends = parsed.map((item: any) => ({
      description: item.description || "",
      keypoints: Array.isArray(item.keypoints)
        ? item.keypoints.join(", ")
        : item.keypoints || "",
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
