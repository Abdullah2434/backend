/**
 * Constants for trends service
 */

import { CityData } from "../types/services/trends.types";

// Cache duration in milliseconds (30 minutes)
export const CACHE_DURATION = 30 * 60 * 1000;

// OpenAI API configuration
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";

// City-specific real estate data for more accurate trends
export const CITY_DATA: Record<string, CityData> = {
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

// Default city data for unknown cities
export const DEFAULT_CITY_DATA: CityData = {
  neighborhoods: ["Downtown", "Suburbs", "Waterfront"],
  priceRange: "$200K - $2M+",
  marketTrend: "Growing real estate market",
  keyFeatures: ["Modern amenities", "Good location"],
  popularAreas: ["Downtown", "Suburbs"],
};

// Real estate keywords for validation
export const REAL_ESTATE_KEYWORDS = [
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
  "title",
  "deed",
  "owner",
  "ownership",
  "landlord",
  "tenant",
  "tenants",
];

// Default keypoints for fallback
export const DEFAULT_KEYPOINTS = [
  "Market insights",
  "Expert guidance",
  "Local expertise",
];

// Inappropriate content patterns
export const INAPPROPRIATE_PATTERNS = {
  racism: [/\b(n-word|racial slur|hate speech)/gi],
  nudity: [/\b(naked|nude|nudity|explicit|porn|xxx|sexually explicit)/gi],
  vulgar: [
    /\b(f\*\*k|fuck|shit|damn|hell|asshole|bitch|bastard|crap)/gi,
  ],
};

// ==================== TRENDS CONTROLLER CONSTANTS ====================
// Trend count limits
export const DEFAULT_TREND_COUNT = 10;
export const MIN_TREND_COUNT = 1;
export const MAX_TREND_COUNT = 20;
export const SUPER_FAST_MAX_COUNT = 3;
export const FAST_MAX_COUNT = 5;
export const TEMPLATE_BASED_THRESHOLD = 5;

// Topic and location defaults
export const TOPIC_REAL_ESTATE = "real_estate";
export const LOCATION_AMERICA = "America";

// Content moderation error keywords
export const CONTENT_MODERATION_KEYWORDS = [
  "CONTENT_MODERATION_ERROR",
  "inappropriate",
  "racism",
  "nudity",
  "vulgar",
] as const;

// Validation error keywords
export const VALIDATION_ERROR_KEYWORDS = [
  "VALIDATION_ERROR",
  "not related to real estate",
  "not real estate related",
] as const;

// OpenAI moderation relevant categories
export const RELEVANT_MODERATION_CATEGORIES = [
  "hate",
  "hate/threatening",
  "self-harm",
  "sexual",
  "sexual/minors",
  "violence",
  "violence/graphic",
];

