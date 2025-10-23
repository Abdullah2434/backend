import axios from "axios";

const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const GROK_API_KEY = process.env.GROK_API_KEY;

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
 * Ultra-optimized trends service for maximum performance
 */
export class OptimizedTrendsService {
  /**
   * Generate trends with minimal API calls and maximum speed
   */
  static async getOptimizedTrends(count: number = 10): Promise<TrendData[]> {
    try {
      // Use the fastest possible approach
      const trends = await this.generateMinimalTrends(count);
      return trends;
    } catch (error) {
      console.error("Optimized trends generation failed:", error);
      return this.getUltraFastFallbackTrends(count);
    }
  }

  /**
   * Generate trends with minimal prompt and fast model
   */
  private static async generateMinimalTrends(
    count: number
  ): Promise<TrendData[]> {
    const prompt = `Generate ${count} US real estate trends. JSON only: [{"description":"trend","keypoints":"points","instagram_caption":"caption","facebook_caption":"caption","linkedin_caption":"caption","twitter_caption":"caption","tiktok_caption":"caption","youtube_caption":"caption"}]`;

    const response = await axios.post(
      GROK_API_URL,
      {
        model: "grok-3", // Fastest model
        messages: [
          {
            role: "system",
            content: "Generate real estate trends. Return JSON array only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1000, // Minimal tokens for speed
        temperature: 0.3, // Low temperature for consistency
      },
      {
        headers: {
          Authorization: `Bearer ${GROK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout (much faster)
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content received");
    }

    // Ultra-fast JSON parsing
    let cleanedContent = content.trim();

    // Quick cleanup
    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "");
    }

    cleanedContent = cleanedContent.replace(/`/g, "");

    // Extract JSON array
    const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanedContent = jsonMatch[0];
    }

    const trends = JSON.parse(cleanedContent) as TrendData[];

    if (!Array.isArray(trends) || trends.length === 0) {
      throw new Error("Invalid trends format");
    }

    return trends;
  }

  /**
   * Ultra-fast fallback trends (pre-generated)
   */
  private static getUltraFastFallbackTrends(count: number): TrendData[] {
    const fallbackTrends: TrendData[] = [
      {
        description: "Mortgage Rates Drop",
        keypoints: "Rates falling",
        instagram_caption:
          "Mortgage rates dropping! 📉 Time to buy? #RealEstate2025",
        facebook_caption:
          "Mortgage rates are dropping! Is this your moment to buy? 🏡",
        linkedin_caption:
          "Mortgage rate decreases are creating new opportunities for buyers. #RealEstateTrends",
        twitter_caption:
          "Mortgage rates dropping! 📉 #MortgageRates #RealEstate2025",
        tiktok_caption: "Rates dropping! 📉 Buy now? #RealEstateBuzz",
        youtube_caption:
          "Mortgage Rate Drop: What This Means for Homebuyers in 2025",
      },
      {
        description: "Housing Inventory Low",
        keypoints: "Few homes available",
        instagram_caption:
          "Housing shortage continues! 🏠 Finding homes? #HousingShortage",
        facebook_caption:
          "The housing inventory shortage is still affecting buyers. Are you struggling to find homes? 🏡",
        linkedin_caption:
          "Housing inventory shortages persist across markets. #RealEstateMarket",
        twitter_caption:
          "Housing shortage continues! 🏠 #HousingShortage #RealEstate2025",
        tiktok_caption: "No homes for sale! 🏠 Where are they? #HousingCrisis",
        youtube_caption:
          "Housing Inventory Shortage: Why There Are So Few Homes for Sale",
      },
      {
        description: "First-Time Buyers Surge",
        keypoints: "Young buyers entering",
        instagram_caption:
          "First-time buyers are back! 🏡 Ready to join? #FirstTimeBuyers",
        facebook_caption:
          "First-time buyers are making a comeback! Are you ready to buy? 🏠",
        linkedin_caption:
          "First-time buyers are re-entering the market. #RealEstateTrends",
        twitter_caption:
          "First-time buyers surging! 🏡 #FirstTimeBuyers #RealEstate2025",
        tiktok_caption:
          "First-time buyers everywhere! 🏡 Are you one? #Homebuying",
        youtube_caption:
          "First-Time Buyer Surge: Why Young People Are Buying Homes Again",
      },
      {
        description: "Remote Work Housing Boom",
        keypoints: "Suburbs gaining popularity",
        instagram_caption:
          "Remote work changing housing! 🏡 Suburbs hot! #RemoteWork",
        facebook_caption:
          "Remote work is reshaping where people want to live. Are you considering a move? 🏡",
        linkedin_caption:
          "Remote work continues to influence housing preferences. #RemoteWorkHousing",
        twitter_caption:
          "Remote work = suburban boom! 🏡 #RemoteWork #RealEstate2025",
        tiktok_caption:
          "Remote work = new home locations! 🏡 You moving? #RemoteWorkLife",
        youtube_caption:
          "Remote Work Revolution: How It's Changing Where People Buy Homes",
      },
      {
        description: "Interest Rate Impact",
        keypoints: "Fed policy affects buyers",
        instagram_caption:
          "Interest rates shifting! 📊 What's next? #InterestRates",
        facebook_caption:
          "Interest rate changes are impacting the housing market. How is this affecting your plans? 🏡",
        linkedin_caption:
          "Federal Reserve policy continues to influence mortgage rates. #RealEstateEconomics",
        twitter_caption:
          "Interest rates moving! 📊 #InterestRates #RealEstate2025",
        tiktok_caption:
          "Interest rates changing! 📊 Should you buy now? #RealEstateBuzz",
        youtube_caption:
          "Interest Rate Impact on Housing: What Buyers Need to Know",
      },
      {
        description: "Luxury Market Cooling",
        keypoints: "High-end sales slowing",
        instagram_caption:
          "Luxury market cooling! 💎 Still hot? #LuxuryRealEstate",
        facebook_caption:
          "The luxury real estate market is showing signs of cooling. Are you seeing this trend? 🏡",
        linkedin_caption:
          "Luxury real estate markets are experiencing a shift. #LuxuryRealEstate",
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
          "Climate risks affecting homes! 🌊 Worried? #ClimateRisk",
        facebook_caption:
          "Climate risks are becoming a bigger factor in home buying decisions. Are you considering this? 🏡",
        linkedin_caption:
          "Climate risk assessment is increasingly important in real estate. #ClimateRisk",
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
        instagram_caption: "Smart homes everywhere! 🤖 Want one? #SmartHomes",
        facebook_caption:
          "Smart home technology is becoming a must-have for many buyers. Are you looking for smart features? 🏡",
        linkedin_caption:
          "Smart home technology is reshaping buyer expectations. #SmartHomes",
        twitter_caption: "Smart homes trending! 🤖 #SmartHomes #RealEstate2025",
        tiktok_caption:
          "Smart homes are everywhere! 🤖 You want one? #SmartHomeLife",
        youtube_caption:
          "Smart Home Revolution: How Technology is Changing Real Estate",
      },
      {
        description: "Generational Shift",
        keypoints: "Millennials dominating market",
        instagram_caption:
          "Millennials taking over! 👥 Are you ready? #MillennialBuyers",
        facebook_caption:
          "Millennials are now the dominant force in the housing market. Are you part of this generation? 🏡",
        linkedin_caption:
          "Millennials are reshaping the real estate market with their preferences. #MillennialBuyers",
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
          "Housing affordability crisis! 💸 Struggling? #HousingCrisis",
        facebook_caption:
          "Housing affordability is a major concern for many. Are you feeling the pinch? 🏡",
        linkedin_caption:
          "The housing affordability crisis continues to challenge buyers. #HousingAffordability",
        twitter_caption:
          "Housing affordability crisis! 💸 #HousingCrisis #RealEstate2025",
        tiktok_caption:
          "Homes too expensive! 💸 You feeling it? #HousingStruggle",
        youtube_caption:
          "Housing Affordability Crisis: Solutions for First-Time Buyers",
      },
    ];

    return fallbackTrends.slice(0, count);
  }

  /**
   * Get trends with compression (minimal data)
   */
  static async getCompressedTrends(count: number = 10): Promise<{
    trends: Array<{
      d: string; // description
      k: string; // keypoints
      captions: {
        ig: string; // instagram
        fb: string; // facebook
        li: string; // linkedin
        tw: string; // twitter
        tt: string; // tiktok
        yt: string; // youtube
      };
    }>;
    cached: boolean;
    source: string;
  }> {
    const trends = await this.getOptimizedTrends(count);

    // Compress the response
    const compressedTrends = trends.map((trend) => ({
      d: trend.description,
      k: trend.keypoints,
      captions: {
        ig: trend.instagram_caption,
        fb: trend.facebook_caption,
        li: trend.linkedin_caption,
        tw: trend.twitter_caption,
        tt: trend.tiktok_caption,
        yt: trend.youtube_caption,
      },
    }));

    return {
      trends: compressedTrends,
      cached: true,
      source: "optimized",
    };
  }
}

export default OptimizedTrendsService;
