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

      const prompt = `Generate engaging social media captions for a real estate video based on the following information:

Topic: ${topic}
Key Points: ${keyPoints}${userContextText}

Create platform-specific captions that are:
1. Engaging and relevant to the real estate industry
2. Optimized for each platform's audience and format
3. Include appropriate emojis and hashtags
4. Professional but approachable tone
5. Include a call-to-action when appropriate

Format your response as JSON:
{
  "instagram_caption": "Instagram caption (engaging, emoji-rich, 1-2 sentences, include relevant hashtags)",
  "facebook_caption": "Facebook caption (informative, 2-3 sentences, community-focused)",
  "linkedin_caption": "LinkedIn caption (professional, business-focused, 2-3 sentences)",
  "twitter_caption": "Twitter caption (concise, hashtag-friendly, 1-2 sentences, under 280 characters)",
  "tiktok_caption": "TikTok caption (trendy, engaging, 1-2 sentences, include trending hashtags)"
}

Make sure each caption is unique and tailored to the platform's audience.`;

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

      // Parse JSON response
      const captions = JSON.parse(content) as SocialMediaCaptions;

      // Validate that all required captions are present
      const requiredCaptions = [
        "instagram_caption",
        "facebook_caption",
        "linkedin_caption",
        "twitter_caption",
        "tiktok_caption",
      ];

      for (const caption of requiredCaptions) {
        if (!captions[caption as keyof SocialMediaCaptions]) {
          throw new Error(`Missing ${caption} in OpenAI response`);
        }
      }

      return captions;
    } catch (error: any) {
      console.error("Error generating captions:", error);

      // Return fallback captions if OpenAI fails
      return {
        instagram_caption: `🏠 ${topic} - ${keyPoints} #RealEstate #Property #Home`,
        facebook_caption: `${topic}: ${keyPoints}. Contact us for more information about real estate opportunities.`,
        linkedin_caption: `Professional insight: ${topic}. ${keyPoints}. Let's connect to discuss real estate opportunities.`,
        twitter_caption: `${topic}: ${keyPoints} #RealEstate #Property`,
        tiktok_caption: `POV: You need to know about ${topic} 🏠 #RealEstate #Property #FYP`,
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
