/**
 * Helper functions for caption generation
 */

import { SocialMediaCaptions, UserContext } from "../types/captionGeneration.types";
import { DEFAULT_CAPTION_LANGUAGE } from "../constants/captionGeneration.constants";

// ==================== JSON CLEANING HELPERS ====================
/**
 * Clean JSON content by removing markdown code blocks and backticks
 */
export function cleanJsonContent(content: string): string {
  let cleaned = content.trim();

  // Remove markdown code blocks if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  // Remove any backticks that might be in the content
  cleaned = cleaned.replace(/`/g, "");

  return cleaned;
}

/**
 * Clean quotation marks from all captions
 */
export function cleanQuotationMarks(captions: SocialMediaCaptions): SocialMediaCaptions {
  return {
    instagram_caption: captions.instagram_caption?.replace(/"/g, "") || "",
    facebook_caption: captions.facebook_caption?.replace(/"/g, "") || "",
    linkedin_caption: captions.linkedin_caption?.replace(/"/g, "") || "",
    twitter_caption: captions.twitter_caption?.replace(/"/g, "") || "",
    tiktok_caption: captions.tiktok_caption?.replace(/"/g, "") || "",
    youtube_caption: captions.youtube_caption?.replace(/"/g, "") || "",
  };
}

/**
 * Validate that all required captions are present
 */
export function validateCaptions(captions: SocialMediaCaptions): void {
  const requiredCaptions = [
    "instagram_caption",
    "facebook_caption",
    "linkedin_caption",
    "twitter_caption",
    "tiktok_caption",
    "youtube_caption",
  ];

  for (const caption of requiredCaptions) {
    if (!captions[caption as keyof SocialMediaCaptions]) {
      throw new Error(`Missing ${caption} in OpenAI response`);
    }
  }
}

// ==================== PROMPT BUILDING HELPERS ====================
/**
 * Format user context into text
 */
export function formatUserContext(userContext?: UserContext): string {
  if (!userContext) {
    return "";
  }

  return `\n\nUser Context:
- Name: ${userContext.name || "Not provided"}
- Position: ${userContext.position || "Not provided"}
- Company: ${userContext.companyName || "Not provided"}
- City: ${userContext.city || "Not provided"}
- Social Handles: ${userContext.socialHandles || "Not provided"}`;
}

/**
 * Get language instruction for the prompt
 */
export function getLanguageInstruction(language?: string): string {
  const captionLanguage = language && language.trim() ? language.trim() : DEFAULT_CAPTION_LANGUAGE;
  
  return captionLanguage === "Spanish"
    ? "Generate all captions in Spanish (Español). All text, hashtags, and content must be in Spanish."
    : "Generate all captions in English.";
}

/**
 * Build the main prompt for caption generation
 */
export function buildCaptionPrompt(
  topic: string,
  keyPoints: string,
  userContext?: UserContext,
  language?: string
): string {
  const userContextText = formatUserContext(userContext);
  const languageInstruction = getLanguageInstruction(language);

  return `Generate comprehensive social media captions for a real estate video based on the following information:

LANGUAGE REQUIREMENT: ${languageInstruction}

TOPIC: ${topic}
KEY POINTS: ${keyPoints}${userContextText}

TOPIC: ${topic}
KEY POINTS: ${keyPoints}${userContextText}

CONTENT STRUCTURE REQUIREMENTS:
Each caption must be ONE FLOWING PARAGRAPH that naturally includes:
1. HOOK: Attention-grabbing opening (2-3 sentences)
2. DESCRIPTION: Detailed explanation of the topic (3-4 sentences)  
3. KEY POINTS: Main benefits/features integrated naturally
4. CALL-TO-ACTION: Naturally woven into the content with contact information
5. HASHTAGS: 10-15 relevant real estate hashtags integrated naturally within the text
6. EMOJIS: Strategic use of real estate emojis (🏠🏘️🏢💰📈) placed naturally

CRITICAL: Do NOT use separate sections like [HASHTAGS] or [CONCLUSION]. Everything must flow as ONE NATURAL PARAGRAPH.
IMPORTANT: Do NOT include quotation marks ("") in your captions. Write clean, natural text without any quotation marks.

PLATFORM SPECIFICATIONS AND TARGET LENGTH RANGES (STRICTLY ENFORCED):
- Instagram: TARGET 1900-1950 characters, ABSOLUTE MAX 2000. Visual storytelling, use line breaks, include 10-15 hashtags, multiple emojis
- Facebook: TARGET 4900-4950 characters, ABSOLUTE MAX 5000. Detailed storytelling, community engagement, include 15-20 hashtags, emojis
- LinkedIn: TARGET 2900-2950 characters, ABSOLUTE MAX 3000. Professional tone, industry insights, include 8-12 hashtags, minimal emojis
- Twitter/X: TARGET 260-270 characters, ABSOLUTE MAX 280. Concise, punchy, include 3-5 hashtags, 1-2 emojis
- TikTok: TARGET 2100-2150 characters, ABSOLUTE MAX 2200. Catchy, trendy, include 5-8 hashtags, multiple emojis
- YouTube: TARGET 4900-4950 characters, ABSOLUTE MAX 5000. SEO-optimized, detailed description, include 15-20 hashtags, emojis

CRITICAL CHARACTER LIMIT REQUIREMENTS:
1. You MUST count characters for each caption as you write it.
2. STAY WITHIN THE TARGET RANGE; NEVER exceed the ABSOLUTE MAX.
3. If you approach the target max, finish the current sentence and STOP—do NOT start a new sentence.
4. If a caption would exceed the limit, shorten by removing less essential words while keeping the core message.
5. Instagram: stay < 2000 | Facebook: < 5000 | LinkedIn: < 3000 | Twitter/X: < 280 | TikTok: < 2200 | YouTube: < 5000.
6. Verify character count before finalizing each caption; captions over max are rejected.

FORMAT YOUR RESPONSE AS JSON:
{
  "instagram_caption": "Attention-grabbing opening that flows naturally into detailed explanation of the topic. Include key benefits and features seamlessly woven throughout. End with a natural call-to-action and contact information. Integrate hashtags like #RealEstate #Property #Home #Investment #Market #Trends #Opportunity #Value #Growth #Success #DreamHome #FirstTimeBuyer naturally within the text. Use emojis strategically 🏠🏘️🏢💰📈",
  "facebook_caption": "Attention-grabbing opening that flows naturally into detailed explanation of the topic. Include key benefits and features seamlessly woven throughout. End with a natural call-to-action and contact information. Integrate hashtags like #RealEstate #Property #Home #Investment #Market #Trends #Opportunity #Value #Growth #Success #DreamHome #FirstTimeBuyer #Investment #Rental #Commercial #Residential #RealEstateAgent #PropertyInvestment naturally within the text. Use emojis strategically 🏠🏘️🏢💰📈",
  "linkedin_caption": "Professional opening that flows naturally into industry insights and business benefits. Include professional call-to-action and contact information seamlessly. Integrate hashtags like #RealEstate #PropertyInvestment #MarketTrends #BusinessGrowth #ProfessionalNetworking #IndustryInsights #PropertyManagement naturally within the text. Use minimal emojis strategically 🏢📈",
  "twitter_caption": "Concise opening that flows into key points and natural call-to-action. Integrate hashtags like #RealEstate #Property #Investment naturally within the text. Use 1-2 emojis strategically 🏠💰",
  "tiktok_caption": "Trendy opening that flows into quick benefits and natural action. Integrate hashtags like #RealEstate #Property #FYP #Trending #Investment #Home #DreamHome #Success naturally within the text. Use multiple emojis strategically 🏠🏘️🏢💰📈",
  "youtube_caption": "SEO-optimized opening that flows naturally into detailed explanation with keywords and comprehensive benefits. Include strong call-to-action and contact information seamlessly. Integrate hashtags like #RealEstate #PropertyInvestment #MarketTrends #RealEstateTips #PropertyInvestment #HomeBuying #RealEstateAgent #PropertyManagement #RealEstateInvestment #PropertyInvestment #RealEstateMarket #PropertyTrends #RealEstateNews #PropertyInvestment #RealEstateAdvice naturally within the text. Use emojis strategically 🏠🏘️🏢💰📈"
}

Make sure each caption is unique, detailed, and tailored to the platform's audience with proper formatting.`;
}

// ==================== FALLBACK HELPERS ====================
/**
 * Generate fallback captions when OpenAI API fails
 */
export function generateFallbackCaptions(
  topic: string,
  keyPoints: string
): SocialMediaCaptions {
  return {
    instagram_caption: `🏠 ${topic} - ${keyPoints} #RealEstate #Property #Home`,
    facebook_caption: `${topic}: ${keyPoints}. Contact us for more information about real estate opportunities.`,
    linkedin_caption: `Professional insight: ${topic}. ${keyPoints}. Let's connect to discuss real estate opportunities.`,
    twitter_caption: `${topic}: ${keyPoints} #RealEstate #Property`,
    tiktok_caption: `POV: You need to know about ${topic} 🏠 #RealEstate #Property #FYP`,
    youtube_caption: `${topic}: ${keyPoints}. Learn more about real estate opportunities and market insights.`,
  };
}

