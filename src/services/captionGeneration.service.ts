import axios from "axios";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface SocialMediaCaptions {
  instagram_caption: string;
  facebook_caption: string;
  linkedin_caption: string;
  twitter_caption: string;
  tiktok_caption: string;
  youtube_caption: string;
}

export class CaptionGenerationService {
  /**
   * Generate social media captions based on topic and key points
   */
  static async generateCaptions(
    topic: string,
    keyPoints: string,
    userContext?: {
      name?: string;
      position?: string;
      companyName?: string;
      city?: string;
      socialHandles?: string;
    }
  ): Promise<SocialMediaCaptions> {
    try {
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }

      const userContextText = userContext
        ? `\n\nUser Context:
- Name: ${userContext.name || "Not provided"}
- Position: ${userContext.position || "Not provided"}
- Company: ${userContext.companyName || "Not provided"}
- City: ${userContext.city || "Not provided"}
- Social Handles: ${userContext.socialHandles || "Not provided"}`
        : "";

      const prompt = `Generate comprehensive social media captions for a real estate video based on the following information:

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

PLATFORM SPECIFICATIONS:
- Instagram (max 2200 chars): Visual storytelling, use line breaks, include 10-15 hashtags, multiple emojis
- Facebook (max 63206 chars): Detailed storytelling, community engagement, include 15-20 hashtags, emojis
- LinkedIn (max 3000 chars): Professional tone, industry insights, include 8-12 hashtags, minimal emojis
- Twitter (max 280 chars): Concise, punchy, include 3-5 hashtags, 1-2 emojis
- TikTok (max 150 chars): Catchy, trendy, include 5-8 hashtags, multiple emojis
- YouTube (max 5000 chars): SEO-optimized, detailed description, include 15-20 hashtags, emojis

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

      const response = await axios.post<OpenAIResponse>(
        OPENAI_API_URL,
        {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a professional social media marketing expert specializing in real estate content. Create engaging, platform-specific captions that drive engagement and conversions.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
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

      // Clean and parse JSON response
      let cleanedContent = content.trim();

      // Remove markdown code blocks if present
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent
          .replace(/^```json\s*/, "")
          .replace(/\s*```$/, "");
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "");
      }

      // Remove any backticks that might be in the content
      cleanedContent = cleanedContent.replace(/`/g, "");

      console.log("Cleaned OpenAI response:", cleanedContent);

      // Parse JSON response
      const captions = JSON.parse(cleanedContent) as SocialMediaCaptions;

      // Clean quotation marks from all captions
      const cleanedCaptions: SocialMediaCaptions = {
        instagram_caption: captions.instagram_caption?.replace(/"/g, "") || "",
        facebook_caption: captions.facebook_caption?.replace(/"/g, "") || "",
        linkedin_caption: captions.linkedin_caption?.replace(/"/g, "") || "",
        twitter_caption: captions.twitter_caption?.replace(/"/g, "") || "",
        tiktok_caption: captions.tiktok_caption?.replace(/"/g, "") || "",
        youtube_caption: captions.youtube_caption?.replace(/"/g, "") || "",
      };

      // Validate that all required captions are present
      const requiredCaptions = [
        "instagram_caption",
        "facebook_caption",
        "linkedin_caption",
        "twitter_caption",
        "tiktok_caption",
        "youtube_caption",
      ];

      for (const caption of requiredCaptions) {
        if (!cleanedCaptions[caption as keyof SocialMediaCaptions]) {
          throw new Error(`Missing ${caption} in OpenAI response`);
        }
      }

      return cleanedCaptions;
    } catch (error: any) {
      console.error("Error generating captions:", error);

      // Return fallback captions if OpenAI fails
      return {
        instagram_caption: `🏠 ${topic} - ${keyPoints} #RealEstate #Property #Home`,
        facebook_caption: `${topic}: ${keyPoints}. Contact us for more information about real estate opportunities.`,
        linkedin_caption: `Professional insight: ${topic}. ${keyPoints}. Let's connect to discuss real estate opportunities.`,
        twitter_caption: `${topic}: ${keyPoints} #RealEstate #Property`,
        tiktok_caption: `POV: You need to know about ${topic} 🏠 #RealEstate #Property #FYP`,
        youtube_caption: `${topic}: ${keyPoints}. Learn more about real estate opportunities and market insights.`,
      };
    }
  }

  /**
   * Generate captions for custom video creation
   */
  static async generateCustomVideoCaptions(
    hook: string,
    body: string,
    conclusion: string,
    userContext?: {
      name?: string;
      position?: string;
      companyName?: string;
      city?: string;
      socialHandles?: string;
    }
  ): Promise<SocialMediaCaptions> {
    const topic = hook;
    const keyPoints = `${body} ${conclusion}`.trim();

    return this.generateCaptions(topic, keyPoints, userContext);
  }

  /**
   * Generate captions for scheduled video
   */
  static async generateScheduledVideoCaptions(
    description: string,
    keypoints: string,
    userContext?: {
      name?: string;
      position?: string;
      companyName?: string;
      city?: string;
      socialHandles?: string;
    }
  ): Promise<SocialMediaCaptions> {
    return this.generateCaptions(description, keypoints, userContext);
  }
}

export default CaptionGenerationService;
