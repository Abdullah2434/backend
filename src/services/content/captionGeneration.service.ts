import axios from "axios";
import {
  OPENAI_API_URL,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_MAX_TOKENS,
  OPENAI_TEMPERATURE,
  CAPTION_GENERATION_SYSTEM_PROMPT,
} from "../../constants/captionGeneration.constants";
import {
  OpenAIResponse,
  SocialMediaCaptions,
  UserContext,
} from "../../types/captionGeneration.types";
import {
  cleanJsonContent,
  cleanQuotationMarks,
  validateCaptions,
  buildCaptionPrompt,
  generateFallbackCaptions,
} from "../../utils/captionGenerationHelpers";
import {
  CAPTION_LIMITS,
  truncateSocialMediaCaptions,
} from "../../utils/captionTruncationHelpers";

// Re-export for backward compatibility
export type { SocialMediaCaptions, UserContext };

export class CaptionGenerationService {
  /**
   * Generate social media captions based on topic and key points
   */
  static async generateCaptions(
    topic: string,
    keyPoints: string,
    userContext?: UserContext,
    language?: string
  ): Promise<SocialMediaCaptions> {
    try {
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }

      // Build prompt using helper function
      const prompt = buildCaptionPrompt(topic, keyPoints, userContext, language);

      // Make OpenAI API request
      const response = await axios.post<OpenAIResponse>(
        OPENAI_API_URL,
        {
          model: OPENAI_MODEL,
          messages: [
            {
              role: "system",
              content: CAPTION_GENERATION_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: OPENAI_MAX_TOKENS,
          temperature: OPENAI_TEMPERATURE,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content received from OpenAI");
      }

      // Clean and parse JSON response using helper functions
      const cleanedContent = cleanJsonContent(content);
      const captions = JSON.parse(cleanedContent) as SocialMediaCaptions;
      const cleanedCaptions = cleanQuotationMarks(captions);

      // Validate captions using helper function
      validateCaptions(cleanedCaptions);

      // Warn if any caption exceeds platform limits before truncation
      for (const [key, limit] of Object.entries(CAPTION_LIMITS)) {
        const captionKey = key as keyof SocialMediaCaptions;
        const value = cleanedCaptions[captionKey];
        if (value && value.length > limit) {
          console.warn(
            `[CaptionGeneration] ${captionKey} length ${value.length} exceeds limit ${limit} before truncation`
          );
        }
      }

      // Truncate captions to platform-specific limits
      const truncatedCaptions = truncateSocialMediaCaptions(cleanedCaptions);

      return truncatedCaptions as SocialMediaCaptions;
    } catch (error: any) {
      // Return fallback captions on error
      return generateFallbackCaptions(topic, keyPoints);
    }
  }

  // ==================== SPECIALIZED CAPTION GENERATION ====================
  /**
   * Generate captions for custom video creation
   */
  static async generateCustomVideoCaptions(
    hook: string,
    body: string,
    conclusion: string,
    userContext?: UserContext,
    language?: string
  ): Promise<SocialMediaCaptions> {
    const topic = hook;
    const keyPoints = `${body} ${conclusion}`.trim();

    return this.generateCaptions(topic, keyPoints, userContext, language);
  }

  /**
   * Generate captions for scheduled video
   */
  static async generateScheduledVideoCaptions(
    description: string,
    keypoints: string,
    userContext?: UserContext,
    language?: string
  ): Promise<SocialMediaCaptions> {
    return this.generateCaptions(description, keypoints, userContext, language);
  }
}

export default CaptionGenerationService;
