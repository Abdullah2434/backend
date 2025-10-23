import axios from "axios";

const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const GROK_API_KEY = process.env.GROK_API_KEY;

// Validate API key
if (!GROK_API_KEY) {
  console.warn("⚠️ GROK_API_KEY not found in environment variables");
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

// Cache for trends (valid for 1 hour)
let trendsCache: TrendData[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Fast trends service with caching and optimized prompts
 */
export class FastTrendsService {
  /**
   * Get trends quickly with caching
   */
  static async getFastTrends(count: number = 10): Promise<TrendData[]> {
    // Check cache first
    if (trendsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
      console.log("⚡ Using cached Grok trends (fast response)");
      return trendsCache.slice(0, count);
    }

    console.log("🚀 Generating fresh trends with Grok AI...");

    try {
      const trends = await this.generateOptimizedTrends(count);

      // Cache the results
      trendsCache = trends;
      cacheTimestamp = Date.now();

      console.log("✅ Successfully generated trends from Grok AI");
      return trends;
    } catch (error) {
      console.error("❌ Grok API failed, trying fallback:", error);

      // Return cached trends if available, even if expired
      if (trendsCache) {
        console.log("🔄 Using expired Grok cache as fallback");
        return trendsCache.slice(0, count);
      }

      // Only use fallback trends as absolute last resort
      console.log("⚠️ Using fallback trends (Grok API unavailable)");
      return this.getFallbackTrends(count);
    }
  }

  /**
   * Generate trends with optimized, shorter prompt for speed
   */
  private static async generateOptimizedTrends(
    count: number
  ): Promise<TrendData[]> {
    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const prompt = `Generate ${count} US real estate trends for ${today}. Return JSON array with: description, keypoints, instagram_caption, facebook_caption, linkedin_caption, twitter_caption, tiktok_caption, youtube_caption. Keep captions under 100 chars.`;

    const response = await axios.post(
      GROK_API_URL,
      {
        model: "grok-3",
        messages: [
          {
            role: "system",
            content:
              "You are a real estate analyst. Generate current, trending US real estate topics. Return valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 2000, // Increased for complete JSON
        temperature: 0.5, // Lower for consistency
      },
      {
        headers: {
          Authorization: `Bearer ${GROK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000, // 60 second timeout for Grok API
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content received from Grok");
    }

    // Clean and parse JSON
    let cleanedContent = content.trim();

    // Remove markdown code blocks
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "");
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");
    }

    // Remove backticks
    cleanedContent = cleanedContent.replace(/`/g, "");

    // Try to extract JSON array from the response
    const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanedContent = jsonMatch[0];
    }

    console.log(
      "🧪 Grok response content:",
      cleanedContent.substring(0, 200) + "..."
    );

    // Try to fix common JSON issues
    try {
      // Parse JSON
      const trends = JSON.parse(cleanedContent) as TrendData[];

      if (!Array.isArray(trends) || trends.length === 0) {
        throw new Error("Invalid trends format from Grok");
      }

      console.log("✅ Successfully parsed Grok response");
      return trends;
    } catch (parseError) {
      console.error("❌ JSON parsing failed:", parseError);

      // Try to extract individual trend objects
      const trendMatches = cleanedContent.match(/\{[^}]*"description"[^}]*\}/g);
      if (trendMatches && trendMatches.length > 0) {
        console.log("🔧 Attempting to parse individual trends...");
        const trends = trendMatches
          .map((match: string) => {
            try {
              return JSON.parse(match);
            } catch (e) {
              return null;
            }
          })
          .filter((trend: any) => trend !== null);

        if (trends.length > 0) {
          console.log(
            `✅ Successfully parsed ${trends.length} individual trends`
          );
          return trends;
        }
      }

      throw new Error("Failed to parse Grok response as JSON");
    }
  }

  /**
   * Fallback trends when API fails
   */
  private static getFallbackTrends(count: number): TrendData[] {
    const fallbackTrends: TrendData[] = [
      {
        description: "Mortgage Rates Fluctuate",
        keypoints: "Rates changing daily",
        instagram_caption:
          "Mortgage rates are shifting! 📈 What's your move? #RealEstate2025 #MortgageRates",
        facebook_caption:
          "Mortgage rates are changing daily. How is this affecting your home buying plans? Let's discuss! 🏡",
        linkedin_caption:
          "Mortgage rate fluctuations continue to impact the housing market. How are you navigating this uncertainty? #RealEstateTrends",
        twitter_caption:
          "Mortgage rates shifting! 📈 #MortgageRates #RealEstate2025",
        tiktok_caption:
          "Mortgage rates changing! 📈 Should you wait? #RealEstateBuzz",
        youtube_caption:
          "Mortgage Rate Fluctuations: What This Means for Homebuyers in 2025",
      },
      {
        description: "Inventory Shortage Continues",
        keypoints: "Few homes available",
        instagram_caption:
          "Housing inventory is tight! 🏠 Finding your dream home? #HousingShortage #RealEstate2025",
        facebook_caption:
          "The housing inventory shortage continues. Are you struggling to find the right home? Share your experience! 🏡",
        linkedin_caption:
          "Housing inventory shortages persist across markets. What strategies are you using to find properties? #RealEstateMarket",
        twitter_caption:
          "Housing inventory shortage! 🏠 #HousingShortage #RealEstate2025",
        tiktok_caption: "No homes for sale! 🏠 Where are they? #HousingCrisis",
        youtube_caption:
          "Housing Inventory Shortage: Why There Are So Few Homes for Sale in 2025",
      },
      {
        description: "First-Time Buyer Surge",
        keypoints: "Young buyers entering",
        instagram_caption:
          "First-time buyers are back! 🏡 Ready to join them? #FirstTimeBuyers #RealEstate2025",
        facebook_caption:
          "First-time buyers are making a comeback! Are you ready to take the plunge? Let's talk! 🏠",
        linkedin_caption:
          "First-time buyers are re-entering the market. What programs and incentives are you seeing? #RealEstateTrends",
        twitter_caption:
          "First-time buyers surging! 🏡 #FirstTimeBuyers #RealEstate2025",
        tiktok_caption:
          "First-time buyers everywhere! 🏡 Are you one? #Homebuying",
        youtube_caption:
          "First-Time Buyer Surge: Why Young People Are Buying Homes Again in 2025",
      },
      {
        description: "Remote Work Housing Boom",
        keypoints: "Suburbs gaining popularity",
        instagram_caption:
          "Remote work changing housing! 🏡 Suburbs are hot! #RemoteWork #RealEstate2025",
        facebook_caption:
          "Remote work is reshaping where people want to live. Are you considering a move? Let's discuss! 🏡",
        linkedin_caption:
          "Remote work continues to influence housing preferences. How is this trend affecting your market? #RemoteWorkHousing",
        twitter_caption:
          "Remote work = suburban boom! 🏡 #RemoteWork #RealEstate2025",
        tiktok_caption:
          "Remote work = new home locations! 🏡 You moving? #RemoteWorkLife",
        youtube_caption:
          "Remote Work Revolution: How It's Changing Where People Buy Homes in 2025",
      },
      {
        description: "Interest Rate Impact",
        keypoints: "Fed policy affects buyers",
        instagram_caption:
          "Interest rates shifting! 📊 What's next? #InterestRates #RealEstate2025",
        facebook_caption:
          "Interest rate changes are impacting the housing market. How is this affecting your plans? Let's talk! 🏡",
        linkedin_caption:
          "Federal Reserve policy continues to influence mortgage rates and housing demand. What's your take? #RealEstateEconomics",
        twitter_caption:
          "Interest rates moving! 📊 #InterestRates #RealEstate2025",
        tiktok_caption:
          "Interest rates changing! 📊 Should you buy now? #RealEstateBuzz",
        youtube_caption:
          "Interest Rate Impact on Housing: What Buyers Need to Know in 2025",
      },
      {
        description: "Luxury Market Cooling",
        keypoints: "High-end sales slowing",
        instagram_caption:
          "Luxury market cooling! 💎 Still hot? #LuxuryRealEstate #RealEstate2025",
        facebook_caption:
          "The luxury real estate market is showing signs of cooling. Are you seeing this trend in your area? 🏡",
        linkedin_caption:
          "Luxury real estate markets are experiencing a shift. How are high-end properties performing in your market? #LuxuryRealEstate",
        twitter_caption:
          "Luxury market cooling! 💎 #LuxuryRealEstate #RealEstate2025",
        tiktok_caption:
          "Luxury homes cooling down! 💎 Still buying? #LuxuryHousing",
        youtube_caption:
          "Luxury Real Estate Market Cooling: What This Means for High-End Buyers",
      },
      {
        description: "Climate Risk Awareness",
        keypoints: "Weather impacts decisions",
        instagram_caption:
          "Climate risks affecting homes! 🌊 Worried? #ClimateRisk #RealEstate2025",
        facebook_caption:
          "Climate risks are becoming a bigger factor in home buying decisions. Are you considering this? Let's discuss! 🏡",
        linkedin_caption:
          "Climate risk assessment is increasingly important in real estate. How are you advising clients? #ClimateRisk",
        twitter_caption:
          "Climate risks hitting real estate! 🌊 #ClimateRisk #RealEstate2025",
        tiktok_caption:
          "Climate risks changing home buying! 🌊 You thinking about it? #ClimateHousing",
        youtube_caption:
          "Climate Risk in Real Estate: How Weather is Changing Home Buying Decisions",
      },
      {
        description: "Tech Integration Growing",
        keypoints: "Smart homes trending",
        instagram_caption:
          "Smart homes everywhere! 🤖 Want one? #SmartHomes #RealEstate2025",
        facebook_caption:
          "Smart home technology is becoming a must-have for many buyers. Are you looking for smart features? 🏡",
        linkedin_caption:
          "Smart home technology is reshaping buyer expectations. How are you incorporating tech into your listings? #SmartHomes",
        twitter_caption: "Smart homes trending! 🤖 #SmartHomes #RealEstate2025",
        tiktok_caption:
          "Smart homes are everywhere! 🤖 You want one? #SmartHomeLife",
        youtube_caption:
          "Smart Home Revolution: How Technology is Changing Real Estate in 2025",
      },
      {
        description: "Generational Shift",
        keypoints: "Millennials dominating market",
        instagram_caption:
          "Millennials taking over! 👥 Are you ready? #MillennialBuyers #RealEstate2025",
        facebook_caption:
          "Millennials are now the dominant force in the housing market. Are you part of this generation? Let's talk! 🏡",
        linkedin_caption:
          "Millennials are reshaping the real estate market with their preferences and buying power. What trends are you seeing? #MillennialBuyers",
        twitter_caption:
          "Millennials dominating housing! 👥 #MillennialBuyers #RealEstate2025",
        tiktok_caption:
          "Millennials buying everything! 👥 You in? #MillennialLife",
        youtube_caption:
          "Millennial Home Buying Power: How This Generation is Shaping Real Estate",
      },
      {
        description: "Affordability Crisis",
        keypoints: "Prices out of reach",
        instagram_caption:
          "Housing affordability crisis! 💸 Struggling? #HousingCrisis #RealEstate2025",
        facebook_caption:
          "Housing affordability is a major concern for many. Are you feeling the pinch? Let's discuss solutions! 🏡",
        linkedin_caption:
          "The housing affordability crisis continues to challenge buyers. What strategies are you seeing in your market? #HousingAffordability",
        twitter_caption:
          "Housing affordability crisis! 💸 #HousingCrisis #RealEstate2025",
        tiktok_caption:
          "Homes too expensive! 💸 You feeling it? #HousingStruggle",
        youtube_caption:
          "Housing Affordability Crisis: Solutions for First-Time Buyers in 2025",
      },
    ];

    return fallbackTrends.slice(0, count);
  }

  /**
   * Clear cache (useful for testing)
   */
  static clearCache(): void {
    trendsCache = null;
    cacheTimestamp = 0;
    console.log("🗑️ Trends cache cleared");
  }

  /**
   * Get cache status
   */
  static getCacheStatus(): { cached: boolean; age: number; valid: boolean } {
    const age = Date.now() - cacheTimestamp;
    const valid = age < CACHE_DURATION;

    return {
      cached: trendsCache !== null,
      age: Math.floor(age / 1000), // age in seconds
      valid,
    };
  }
}

export default FastTrendsService;
