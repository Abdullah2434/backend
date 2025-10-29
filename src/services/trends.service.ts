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
      keypoints: `High-end properties, Premium locations, Exclusive amenities`,
      instagram_caption: "",
      facebook_caption: "",
      linkedin_caption: "",
      twitter_caption: "",
      tiktok_caption: "",
      youtube_caption: "",
    },
    {
      description: `${city} Investment Properties`,
      keypoints: "Rental income, Appreciation potential, Strong ROI",
      instagram_caption: "",
      facebook_caption: "",
      linkedin_caption: "",
      twitter_caption: "",
      tiktok_caption: "",
      youtube_caption: "",
    },
    {
      description: `${city} First-Time Buyers`,
      keypoints: "Affordable options, Starter homes, Financing assistance",
      instagram_caption: "",
      facebook_caption: "",
      linkedin_caption: "",
      twitter_caption: "",
      tiktok_caption: "",
      youtube_caption: "",
    },
    {
      description: `${city} Market Trends`,
      keypoints: "Price growth, Market insights, Inventory updates",
      instagram_caption: "",
      facebook_caption: "",
      linkedin_caption: "",
      twitter_caption: "",
      tiktok_caption: "",
      youtube_caption: "",
    },
    {
      description: `${city} New Developments`,
      keypoints: "Modern amenities, New construction, Growing neighborhoods",
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
function generateFastTrends(
  city: string,
  position: string,
  count: number
): TrendData[] {
  const cityInfo = cityData[city] || {
    neighborhoods: ["Downtown", "Suburbs", "Waterfront"],
    priceRange: "$200K - $2M+",
    marketTrend: "Growing real estate market",
    keyFeatures: ["Modern amenities", "Good location"],
    popularAreas: ["Downtown", "Suburbs"],
  };

  // Position-specific templates (minimum 3 keypoints each)
  const positionTemplates = {
    "Real Estate Agent": [
      {
        description: `${city} Luxury Homes`,
        keypoints: `High-end properties, Premium locations, Exclusive amenities`,
      },
      {
        description: `${city} Investment Properties`,
        keypoints: `Rental income potential, Strong ROI, Market appreciation`,
      },
      {
        description: `${city} First-Time Buyers`,
        keypoints: `Affordable pricing, Financing assistance, Educational resources`,
      },
      {
        description: `${city} New Developments`,
        keypoints: `Modern amenities, Latest design trends, Growing neighborhoods`,
      },
      {
        description: `${city} Market Trends`,
        keypoints: `Price analysis, Inventory updates, Buyer demand insights`,
      },
    ],
    "Real Estate Broker": [
      {
        description: `${city} Commercial Properties`,
        keypoints: `Business opportunities, Strategic locations, Investment potential`,
      },
      {
        description: `${city} Luxury Market`,
        keypoints: `Premium properties, High-end clientele, Exclusive listings`,
      },
      {
        description: `${city} Investment Portfolio`,
        keypoints: `Diversified assets, Risk management, Long-term returns`,
      },
      {
        description: `${city} Market Leadership`,
        keypoints: `Brokerage excellence, Industry expertise, Proven results`,
      },
      {
        description: `${city} Client Success`,
        keypoints: `Track record, Client satisfaction, Market knowledge`,
      },
    ],
    "Loan Broker": [
      {
        description: `${city} Mortgage Solutions`,
        keypoints: `Flexible financing, Multiple lenders, Best rates`,
      },
      {
        description: `${city} First-Time Buyers`,
        keypoints: `Low down payment, First-time programs, Educational support`,
      },
      {
        description: `${city} Refinancing Boom`,
        keypoints: `Lower rates, Cash-out options, Reduced payments`,
      },
      {
        description: `${city} Investment Loans`,
        keypoints: `Rental property financing, Portfolio loans, Investment strategies`,
      },
      {
        description: `${city} Loan Approval`,
        keypoints: `Fast pre-approval, Streamlined process, Expert guidance`,
      },
    ],
    "Loan Officer": [
      {
        description: `${city} Home Loans`,
        keypoints: `Competitive rates, Flexible terms, Quick approval`,
      },
      {
        description: `${city} VA Loans`,
        keypoints: `Military benefits, Zero down payment, No PMI required`,
      },
      {
        description: `${city} FHA Loans`,
        keypoints: `Low down payment, Flexible credit, Government backing`,
      },
      {
        description: `${city} Conventional Loans`,
        keypoints: `Traditional products, Fixed rates, Standard terms`,
      },
      {
        description: `${city} Loan Process`,
        keypoints: `Streamlined application, Expert guidance, Fast closing`,
      },
    ],
  };

  // Get templates for the specific position (case-insensitive matching)
  // Normalize position for template lookup while preserving original for cache/logging
  const normalizedForTemplate = position.trim();

  // Find matching template key (case-insensitive)
  let templates = positionTemplates["Real Estate Agent"]; // Default fallback
  const templateKeys = Object.keys(positionTemplates) as Array<
    keyof typeof positionTemplates
  >;
  const matchedKey = templateKeys.find(
    (key) => key.toLowerCase() === normalizedForTemplate.toLowerCase()
  );

  if (matchedKey) {
    templates = positionTemplates[matchedKey];
    console.log(
      `✅ Matched template for position: "${position}" → "${matchedKey}"`
    );
  } else {
    console.warn(
      `⚠️ No template match for position: "${position}", using default "Real Estate Agent" templates`
    );
  }

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

// Validate if description is real estate/property related
async function validateRealEstateDescription(
  description: string
): Promise<boolean> {
  try {
    if (!OPENAI_API_KEY) {
      // If no API key, use keyword-based validation as fallback
      return validateWithKeywords(description);
    }

    const validationPrompt = `Analyze this description and determine if it's related to real estate, property, housing, mortgages, loans, or real estate professionals (agents, brokers, loan officers).

Description: "${description}"

Return ONLY a JSON object with this exact format:
{
  "isRealEstateRelated": true or false,
  "reason": "brief explanation"
}

The description is real estate related if it mentions:
- Properties, homes, houses, apartments, condos, real estate
- Buying, selling, renting, investing in property
- Real estate agents, brokers, loan officers, mortgage brokers
- Mortgages, loans, financing, refinancing
- Property values, market trends, housing market
- Neighborhoods, locations, real estate transactions

Return ONLY valid JSON, no additional text.`;

    const response = await axios.post<OpenAIResponse>(
      OPENAI_API_URL,
      {
        model: "gpt-3.5-turbo",
        messages: [
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
        temperature: 0.3, // Lower temperature for more consistent validation
        max_tokens: 200,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 15000,
      }
    );

    const content = response.data.choices[0]?.message?.content?.trim();
    if (!content) {
      // Fallback to keyword validation
      return validateWithKeywords(description);
    }

    let parsed: any = extractJsonFromText(content);
    if (parsed && typeof parsed.isRealEstateRelated === "boolean") {
      return parsed.isRealEstateRelated;
    }

    // Fallback to keyword validation if AI response is invalid
    return validateWithKeywords(description);
  } catch (error) {
    console.warn(
      "Error validating description with AI, falling back to keyword validation:",
      error
    );
    return validateWithKeywords(description);
  }
}

// Keyword-based validation fallback
function validateWithKeywords(description: string): boolean {
  const lowerDescription = description.toLowerCase();

  const realEstateKeywords = [
    // Property types
    "property",
    "properties",
    "home",
    "homes",
    "house",
    "houses",
    "housing",
    "apartment",
    "apartments",
    "condo",
    "condos",
    "townhouse",
    "townhouse",
    "real estate",
    "realestate",
    "realty",

    // Actions
    "buy",
    "buying",
    "sell",
    "selling",
    "sale",
    "rent",
    "renting",
    "rental",
    "invest",
    "investment",
    "investing",
    "mortgage",
    "refinance",
    "refinancing",

    // Professionals
    "agent",
    "broker",
    "loan officer",
    "realtor",
    "mortgage broker",

    // Terms
    "listing",
    "listings",
    "market",
    "marketplace",
    "neighborhood",
    "neighborhoods",
    "location",
    "locations",
    "property value",
    "appraisal",
    "closing",
    "escrow",
    "down payment",
    "interest rate",
    "loan",
    "loans",
    "financing",
    "financing",
    "title",
    "deed",
    "owner",
    "ownership",
    "landlord",
    "tenant",
    "tenants",
  ];

  // Check if description contains at least one real estate keyword
  return realEstateKeywords.some((keyword) =>
    lowerDescription.includes(keyword)
  );
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

    // Validate that description is real estate related
    console.log(
      `🔍 Validating description: "${description.substring(0, 100)}..."`
    );
    const isRealEstateRelated = await validateRealEstateDescription(
      description
    );

    if (!isRealEstateRelated) {
      throw new Error(
        "VALIDATION_ERROR: Description is not related to real estate topics. Please provide a description related to: (1) Real Estate - properties, homes, houses, apartments, condos, commercial real estate; (2) Property - buying, selling, renting, investing in properties; (3) Housing - residential properties, housing market, homeownership, rental properties; (4) Mortgages/Loans - mortgage loans, refinancing, home financing, loan products; (5) Real Estate Professionals - real estate agents, brokers, loan officers, mortgage brokers, realtors."
      );
    }

    console.log(`✅ Description validated as real estate related`);

    const cityInfo = city ? cityData[city] : null;
    const cityContext = cityInfo
      ? ` for ${city} real estate market (${cityInfo.marketTrend}, ${cityInfo.priceRange})`
      : " for real estate";

    const prompt = `Based on this description: "${description}"

Generate keypoints and social media captions${cityContext}.

Return a JSON object with:
- keypoints: MUST include at least 3 keypoints, separated by commas (minimum 3, maximum 5 keypoints). Format: "keypoint1, keypoint2, keypoint3"
- instagram_caption: engaging, emoji-rich, 1-2 sentences
- facebook_caption: informative, 2-3 sentences  
- linkedin_caption: professional, 2-3 sentences
- twitter_caption: concise, hashtag-friendly, 1-2 sentences
- tiktok_caption: trendy, engaging, 1-2 sentences
- youtube_caption: descriptive, SEO-friendly, 2-3 sentences

Return only valid JSON:
{
  "keypoints": "keypoint1, keypoint2, keypoint3",
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

    // Ensure minimum 3 keypoints - split by comma and validate
    let keypoints = parsed.keypoints || "";
    const keypointArray = keypoints
      .split(",")
      .map((kp: string) => kp.trim())
      .filter((kp: string) => kp.length > 0);

    // If less than 3 keypoints, add default ones
    if (keypointArray.length < 3) {
      const defaultKeypoints = [
        "Market insights",
        "Expert guidance",
        "Local expertise",
      ];
      const needed = 3 - keypointArray.length;
      for (let i = 0; i < needed; i++) {
        keypointArray.push(defaultKeypoints[i] || `Key point ${i + 1}`);
      }
      keypoints = keypointArray.join(", ");
    }

    return {
      description: description,
      keypoints: keypoints,
    };
  } catch (error) {
    console.error(`Error generating content from description:`, error);

    // Re-throw validation errors (they should be returned as 400 errors)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("not related to real estate") ||
      errorMessage.includes("not real estate related")
    ) {
      throw error; // Re-throw validation errors
    }

    // Return fallback content only for AI/processing errors, not validation errors
    return {
      description: description,
      keypoints: "Property features, Location benefits, Investment potential",
    };
  }
}

export async function generateCityBasedTrends(
  city: string,
  position: string,
  count: number = 10,
  retryCount = 0,
  seed: number = 0
): Promise<TrendData[]> {
  try {
    // Normalize city and position for consistent cache keys
    // Trim spaces and convert to lowercase to handle any variations
    const normalizedCity = city.trim().toLowerCase();
    const normalizedPosition = position.trim().toLowerCase();

    // Check cache first with city and position
    // Cache key includes both city and position - any change to either will generate new cache
    const cacheKey = `${normalizedCity}_${normalizedPosition}_${count}`;
    const cached = trendsCache.get(cacheKey);

    console.log(
      `🔍 Cache lookup: City="${city}", Position="${position}" → Cache Key: "${cacheKey}"`
    );

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(
        `✅ Cache HIT: Returning cached trends for ${city} (${position}) - Cache Key: ${cacheKey}`
      );
      return cached.data;
    }

    if (cached) {
      console.log(
        `⏰ Cache EXPIRED: Generating new trends for ${city} (${position}) - Cache Key: ${cacheKey}`
      );
    } else {
      console.log(
        `🆕 Cache MISS: Generating new trends for ${city} (${position}) - Cache Key: ${cacheKey}`
      );
    }

    // For fast mode or small counts, use template-based generation
    if (count <= 5) {
      console.log(`Using fast template generation for ${city} (${position})`);
      const trends = generateFastTrends(city, position, count);

      // Cache the results with city and position in key
      trendsCache.set(cacheKey, {
        data: trends,
        timestamp: Date.now(),
      });
      console.log(
        `💾 Cache SAVED: Trends cached for ${city} (${position}) - Cache Key: ${cacheKey}`
      );

      return trends;
    }

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const prompt = `
Generate EXACTLY ${count} current topic trends for creating video ads about real estate in ${city} specifically for ${position}s (batch ${
      seed + 1
    }). You MUST return exactly ${count} trends - no more, no less.
Each trend should highlight a unique aspect of the real estate industry specific to ${city} that's ideal for engaging video advertising for ${position}s.
Focus on local market conditions, city-specific amenities, neighborhood trends, and regional real estate opportunities in ${city} that would be relevant for ${position}s.  
Avoid generic trends and focus on what makes ${city} real estate unique for ${position}s.

CRITICAL: Return exactly ${count} items in the JSON array. Do not include any additional text, explanations, or comments outside the JSON array.

For each trend, include:
1. A short, catchy description (5–6 words max)
2. Key points: MUST include at least 3 keypoints, separated by commas (minimum 3, maximum 5 keypoints)
3. NO platform-specific captions - these will be generated later with dynamic post generation  

Return your result as a valid JSON array with EXACTLY ${count} objects like this:
[
  {
    "description": "",
    "keypoints": "keypoint1, keypoint2, keypoint3"
  }
]
Ensure all fields are filled and formatted as strings. Keypoints must be a comma-separated string with at least 3 items.
`;

    const response = await axios.post<OpenAIResponse>(
      OPENAI_API_URL,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a real estate marketing strategist and video content expert specializing in ${city} real estate market for ${position}s. Provide concise, clear, and engaging trend ideas suitable for multiple social platforms that are specifically relevant to ${position}s. You MUST always return exactly the requested number of trends - no more, no less. Return only valid JSON array format with no additional text.`,
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
            keypoints: "Market insights, Expert guidance, Local expertise",
          });
        }
      } else {
        // If we got more than requested, trim to requested count
        parsed = parsed.slice(0, count);
      }
    }

    const mappedTrends = parsed.map((item: any) => {
      let keypoints = Array.isArray(item.keypoints)
        ? item.keypoints.join(", ")
        : item.keypoints || "";

      // Ensure minimum 3 keypoints - split by comma and validate
      const keypointArray = keypoints
        .split(",")
        .map((kp: string) => kp.trim())
        .filter((kp: string) => kp.length > 0);

      // If less than 3 keypoints, add default ones
      if (keypointArray.length < 3) {
        const defaultKeypoints = [
          "Market insights",
          "Expert guidance",
          "Local expertise",
        ];
        const needed = 3 - keypointArray.length;
        for (let i = 0; i < needed; i++) {
          keypointArray.push(defaultKeypoints[i] || `Key point ${i + 1}`);
        }
        keypoints = keypointArray.join(", ");
      }

      return {
        description: item.description || "",
        keypoints: keypoints,
      };
    });

    // Cache the results with city and position in key
    trendsCache.set(cacheKey, {
      data: mappedTrends,
      timestamp: Date.now(),
    });
    console.log(
      `💾 Cache SAVED: AI-generated trends cached for ${city} (${position}) - Cache Key: ${cacheKey}`
    );

    return mappedTrends;
  } catch (error) {
    if (retryCount < 1) {
      console.warn(
        `First attempt failed for ${city} (${position}), retrying once...`
      );
      return await generateCityBasedTrends(
        city,
        position,
        count,
        retryCount + 1,
        seed
      );
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
