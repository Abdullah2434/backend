import dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config();

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
 * Generate 10 current US real estate trends for today
 */
async function generateUSTrends(): Promise<void> {
  try {
    console.log("🇺🇸 GENERATING 10 CURRENT US REAL ESTATE TRENDS");
    console.log("==============================================\n");

    if (!GROK_API_KEY) {
      console.log("❌ GROK_API_KEY not found in environment variables");
      return;
    }

    console.log("✅ Grok API key found");
    console.log(`🔑 Key: ${GROK_API_KEY.substring(0, 10)}...`);

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const prompt = `
You are a real estate market analyst with access to the latest trending data and current market conditions. Generate exactly 10 current, trending real estate topics for the US market for video content creation.

FOCUS ON CURRENT US REAL ESTATE TRENDS (as of ${today}):
- Latest US market movements and news
- Trending real estate topics on US social media
- Current US buyer/seller concerns and interests
- Recent US policy changes affecting real estate
- Emerging US market trends and opportunities
- Seasonal US real estate patterns
- Technology trends in US real estate
- Economic factors currently impacting the US market
- Federal Reserve interest rate impacts
- US housing supply and demand trends
- Regional US market variations
- US mortgage rate trends

REQUIREMENTS:
1. Each topic should be CURRENT and TRENDING in the US market (not generic evergreen content)
2. Focus on what's happening RIGHT NOW in US real estate
3. Include topics that are generating buzz in the US real estate industry
4. Consider seasonal factors and current US market conditions
5. Make topics engaging for video content creation
6. Focus specifically on US market trends, not global

For each trend, provide:
1. A catchy, current description (5-6 words max) - make it sound like breaking US news
2. Key points (no more than 5 words) - focus on what's trending in the US
3. Platform-specific captions that reflect current US market sentiment:
   - Instagram: Engaging, emoji-rich, current US trend-focused
   - Facebook: Informative, community-focused, trending US topic
   - LinkedIn: Professional, US industry insight, current market analysis
   - Twitter: Concise, trending hashtags, breaking US news style
   - TikTok: Trendy, viral-worthy, current US market buzz
   - YouTube: SEO-optimized, detailed, trending US topic analysis

Return as valid JSON array with exactly 10 trends:
[
  {
    "description": "Current trending US topic description",
    "keypoints": "Key trending US points",
    "instagram_caption": "Trending US content with current hashtags",
    "facebook_caption": "Current US market insight for community",
    "linkedin_caption": "Professional analysis of current US trend",
    "twitter_caption": "Breaking US news style with trending hashtags",
    "tiktok_caption": "Viral-worthy current US trend content",
    "youtube_caption": "Detailed analysis of trending US topic"
  }
]

Make sure all content reflects CURRENT US TRENDS and what's happening in US real estate RIGHT NOW.
    `.trim();

    console.log("🤖 Calling Grok API to generate US trends...");

    const response = await axios.post(
      GROK_API_URL,
      {
        model: "grok-3",
        messages: [
          {
            role: "system",
            content:
              "You are a real estate market analyst with access to the latest trending data. You provide current, trending real estate insights that are perfect for engaging video content. You always focus on what's happening RIGHT NOW in the US real estate market.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 3000,
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${GROK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content received from Grok");
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

    // Remove any backticks
    cleanedContent = cleanedContent.replace(/`/g, "");

    console.log("📊 Grok response received, parsing...");

    // Parse JSON response
    const trends = JSON.parse(cleanedContent) as TrendData[];

    // Validate trends
    if (!Array.isArray(trends) || trends.length === 0) {
      throw new Error("Invalid trends format from Grok");
    }

    console.log(`✅ Generated ${trends.length} US real estate trends\n`);

    // Display the trends
    console.log("🇺🇸 CURRENT US REAL ESTATE TRENDS");
    console.log("==================================\n");

    trends.forEach((trend, index) => {
      console.log(`📈 TREND ${index + 1}: ${trend.description}`);
      console.log(`   Key Points: ${trend.keypoints}`);
      console.log(`   📱 Instagram: ${trend.instagram_caption}`);
      console.log(`   💼 LinkedIn: ${trend.linkedin_caption}`);
      console.log(`   🐦 Twitter: ${trend.twitter_caption}`);
      console.log(`   🎵 TikTok: ${trend.tiktok_caption}`);
      console.log(`   📺 YouTube: ${trend.youtube_caption}`);
      console.log("");
    });

    console.log("✅ US trends generation completed successfully!");
    console.log(
      "🎉 Your system now has 10 current, trending US real estate topics!"
    );
  } catch (error: any) {
    console.error("❌ Error generating US trends:", error);

    if (error.response?.data?.error) {
      console.error("Grok API Error:", error.response.data.error);
    }

    console.log("\n🔧 Troubleshooting:");
    console.log("1. Verify GROK_API_KEY is correctly set in .env file");
    console.log("2. Check your internet connection");
    console.log(
      "3. Ensure the Grok API key is valid and has sufficient credits"
    );
    console.log("4. Check if the Grok API endpoint is accessible");
  }
}

// Run if called directly
if (require.main === module) {
  generateUSTrends()
    .then(() => {
      console.log("\n✅ US trends generation completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ US trends generation failed:", error);
      process.exit(1);
    });
}

export default generateUSTrends;
