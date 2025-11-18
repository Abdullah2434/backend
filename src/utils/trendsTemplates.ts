/**
 * Position-specific trend templates
 */

import { TrendData } from "../types/services/trends.types";

export interface PositionTemplates {
  [key: string]: TrendData[];
}

/**
 * Get position-specific templates
 */
export function getPositionTemplates(
  city: string,
  position: string
): TrendData[] {
  const normalizedPosition = position.trim().toLowerCase();

  const positionTemplates: PositionTemplates = {
    "real estate agent": [
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
    "real estate broker": [
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
    "loan broker": [
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
    "loan officer": [
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

  // Find matching template key (case-insensitive)
  const templateKeys = Object.keys(positionTemplates);
  const matchedKey = templateKeys.find(
    (key) => key.toLowerCase() === normalizedPosition
  );

  // Default to "Real Estate Agent" if no match found
  return matchedKey
    ? positionTemplates[matchedKey]
    : positionTemplates["real estate agent"];
}

/**
 * Generate trends from templates
 */
export function generateTrendsFromTemplates(
  templates: TrendData[],
  count: number
): TrendData[] {
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

/**
 * Generate fallback trends
 */
export function generateFallbackTrends(
  city: string,
  count: number
): TrendData[] {
  const fallbackTrends: TrendData[] = [
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

  return generateTrendsFromTemplates(fallbackTrends, count);
}
