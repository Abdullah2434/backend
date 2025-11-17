/**
 * OpenAI prompts for trends generation
 */

/**
 * Build validation prompt for real estate description
 */
export function buildValidationPrompt(description: string): string {
  return `Analyze this description and determine if it's related to real estate, property, housing, mortgages, loans, or real estate professionals (agents, brokers, loan officers).

Description: "${description}"

Return ONLY a JSON object with this exact format:
{
  "reason": "brief explanation"
}

CONTENT POLICY:
Users can search for anything related to real estate, EXCEPT:
- Racism or discriminatory language (hate speech, racial slurs, discriminatory comments)
- Sexual or explicit content (pornographic, sexually explicit, nudity-related content)
- Vulgar or profane language (profanity, offensive language, inappropriate slurs)

If the description contains ANY of the prohibited content above, you MUST mark it as not real estate related (isRealEstateRelated: false) with reason explaining the content violation.

The description is real estate related if it mentions:
- Properties, homes, houses, apartments, condos, real estate
- Buying, selling, renting, investing in property
- Real estate agents, brokers, loan officers, mortgage brokers
- Mortgages, loans, financing, refinancing
- Property values, market trends, housing market
- Neighborhoods, locations, real estate transactions

IMPORTANT: If the description contains racism, discriminatory language, sexual/explicit content, or vulgar/profane language, you MUST return isRealEstateRelated: false regardless of whether it mentions real estate topics. Reject inappropriate content completely.

Return ONLY valid JSON, no additional text.`;
}

/**
 * Build prompt for generating keypoints and captions from description
 */
export function buildDescriptionGenerationPrompt(
  description: string,
  city?: string,
  cityContext?: string
): string {
  return `Based on this description: "${description}"

Generate keypoints and social media captions${cityContext ? cityContext : ""}.

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
}

/**
 * Build system message for description generation
 */
export function buildDescriptionSystemMessage(city?: string): string {
  return `You are a real estate marketing expert${
    city ? ` specializing in ${city} real estate` : ""
  }. Generate engaging social media content from property descriptions. Return only valid JSON format.`;
}

/**
 * Build prompt for city-based trends generation
 */
export function buildCityBasedTrendsPrompt(
  city: string,
  position: string,
  count: number,
  seed: number
): string {
  return `
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
}

/**
 * Build system message for city-based trends
 */
export function buildCityBasedTrendsSystemMessage(
  city: string,
  position: string
): string {
  return `You are a real estate marketing strategist and video content expert specializing in ${city} real estate market for ${position}s. Provide concise, clear, and engaging trend ideas suitable for multiple social platforms that are specifically relevant to ${position}s. You MUST always return exactly the requested number of trends - no more, no less. Return only valid JSON array format with no additional text.`;
}

/**
 * Build prompt for general real estate trends generation
 */
export function buildRealEstateTrendsPrompt(
  count: number,
  seed: number
): string {
  return `
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
}

/**
 * Build system message for general real estate trends
 */
export function buildRealEstateTrendsSystemMessage(): string {
  return "You are a real estate marketing strategist and video content expert. Provide concise, clear, and engaging trend ideas suitable for multiple social platforms. You MUST always return exactly the requested number of trends - no more, no less. Return only valid JSON array format with no additional text.";
}

