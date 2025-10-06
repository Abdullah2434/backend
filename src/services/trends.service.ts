import axios from 'axios';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
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

export async function generateRealEstateTrends(): Promise<TrendData[]> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const prompt = `Generate top 10 topic trends to create video ads for real estate in America. Each trend should focus on a different aspect of the real estate industry that would be perfect for video advertising. Provide:

For each of the 10 trends, include:
1. A comprehensive description (5-6 words that look like a title) about current real estate trends in America
2. Key points covering the most important aspects not more than 5 words
3. Platform-specific captions for each social media platform:
   - Instagram caption (engaging, emoji-rich, 1-2 sentences)
   - Facebook caption (informative, 2-3 sentences)
   - LinkedIn caption (professional, business-focused, 2-3 sentences)
   - Twitter caption (concise, hashtag-friendly, 1-2 sentences)
   - TikTok caption (trendy, engaging, 1-2 sentences)
   - YouTube caption (descriptive, SEO-friendly, 2-3 sentences)

Format your response as JSON array:
[
  {
    "description": "Description for trend 1",
    "keypoints": "Key points for trend 1",
    "instagram_caption": "Instagram caption for trend 1",
    "facebook_caption": "Facebook caption for trend 1",
    "linkedin_caption": "LinkedIn caption for trend 1",
    "twitter_caption": "Twitter caption for trend 1",
    "tiktok_caption": "TikTok caption for trend 1",
    "youtube_caption": "YouTube caption for trend 1"
  },
  {
    "description": "Description for trend 2", 
    "keypoints": "Key points for trend 2",
    "instagram_caption": "Instagram caption for trend 2",
    "facebook_caption": "Facebook caption for trend 2",
    "linkedin_caption": "LinkedIn caption for trend 2",
    "twitter_caption": "Twitter caption for trend 2",
    "tiktok_caption": "TikTok caption for trend 2",
    "youtube_caption": "YouTube caption for trend 2"
  },
  {
    "description": "Description for trend 3",
    "keypoints": "Key points for trend 3",
    "instagram_caption": "Instagram caption for trend 3",
    "facebook_caption": "Facebook caption for trend 3",
    "linkedin_caption": "LinkedIn caption for trend 3",
    "twitter_caption": "Twitter caption for trend 3",
    "tiktok_caption": "TikTok caption for trend 3",
    "youtube_caption": "YouTube caption for trend 3"
  },
  {
    "description": "Description for trend 4",
    "keypoints": "Key points for trend 4",
    "instagram_caption": "Instagram caption for trend 4",
    "facebook_caption": "Facebook caption for trend 4",
    "linkedin_caption": "LinkedIn caption for trend 4",
    "twitter_caption": "Twitter caption for trend 4",
    "tiktok_caption": "TikTok caption for trend 4",
    "youtube_caption": "YouTube caption for trend 4"
  },
  {
    "description": "Description for trend 5",
    "keypoints": "Key points for trend 5",
    "instagram_caption": "Instagram caption for trend 5",
    "facebook_caption": "Facebook caption for trend 5",
    "linkedin_caption": "LinkedIn caption for trend 5",
    "twitter_caption": "Twitter caption for trend 5",
    "tiktok_caption": "TikTok caption for trend 5",
    "youtube_caption": "YouTube caption for trend 5"
  },
  {
    "description": "Description for trend 6",
    "keypoints": "Key points for trend 6",
    "instagram_caption": "Instagram caption for trend 6",
    "facebook_caption": "Facebook caption for trend 6",
    "linkedin_caption": "LinkedIn caption for trend 6",
    "twitter_caption": "Twitter caption for trend 6",
    "tiktok_caption": "TikTok caption for trend 6",
    "youtube_caption": "YouTube caption for trend 6"
  },
  {
    "description": "Description for trend 7",
    "keypoints": "Key points for trend 7",
    "instagram_caption": "Instagram caption for trend 7",
    "facebook_caption": "Facebook caption for trend 7",
    "linkedin_caption": "LinkedIn caption for trend 7",
    "twitter_caption": "Twitter caption for trend 7",
    "tiktok_caption": "TikTok caption for trend 7",
    "youtube_caption": "YouTube caption for trend 7"
  },
  {
    "description": "Description for trend 8",
    "keypoints": "Key points for trend 8",
    "instagram_caption": "Instagram caption for trend 8",
    "facebook_caption": "Facebook caption for trend 8",
    "linkedin_caption": "LinkedIn caption for trend 8",
    "twitter_caption": "Twitter caption for trend 8",
    "tiktok_caption": "TikTok caption for trend 8",
    "youtube_caption": "YouTube caption for trend 8"
  },
  {
    "description": "Description for trend 9",
    "keypoints": "Key points for trend 9",
    "instagram_caption": "Instagram caption for trend 9",
    "facebook_caption": "Facebook caption for trend 9",
    "linkedin_caption": "LinkedIn caption for trend 9",
    "twitter_caption": "Twitter caption for trend 9",
    "tiktok_caption": "TikTok caption for trend 9",
    "youtube_caption": "YouTube caption for trend 9"
  },
  {
    "description": "Description for trend 10",
    "keypoints": "Key points for trend 10",
    "instagram_caption": "Instagram caption for trend 10",
    "facebook_caption": "Facebook caption for trend 10",
    "linkedin_caption": "LinkedIn caption for trend 10",
    "twitter_caption": "Twitter caption for trend 10",
    "tiktok_caption": "TikTok caption for trend 10",
    "youtube_caption": "YouTube caption for trend 10"
  }
]

Make each trend current, relevant, and engaging for real estate video ads. Focus on different aspects like market trends, technology, investment opportunities, regulatory changes, and consumer behavior that would make compelling video content. Each caption should be tailored to the specific platform's audience and style.`;

    const response = await axios.post<OpenAIResponse>(
      OPENAI_API_URL,
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a real estate market analyst and video marketing expert providing current, accurate, and engaging market insights specifically for video advertising content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 4000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from ChatGPT');
    }

    // Parse the JSON response
    try {
      // Remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsedData = JSON.parse(cleanContent);
      
      // Ensure it's an array
      if (!Array.isArray(parsedData)) {
        throw new Error('Expected array response from ChatGPT');
      }
      
      // Process each item in the array
      return parsedData.map((item: any) => {
        // Handle keypoints - convert array to string if needed
        let keypoints = item.keypoints;
        if (Array.isArray(keypoints)) {
          keypoints = keypoints.join(', ');
        }
        
        return {
          description: item.description,
          keypoints: keypoints,
          instagram_caption: item.instagram_caption || '',
          facebook_caption: item.facebook_caption || '',
          linkedin_caption: item.linkedin_caption || '',
          twitter_caption: item.twitter_caption || '',
          tiktok_caption: item.tiktok_caption || '',
          youtube_caption: item.youtube_caption || ''
        };
      });
      
    } catch (parseError) {
      console.error('Error parsing ChatGPT response:', parseError);
      console.log('Raw response:', content);
      throw new Error('Failed to parse ChatGPT response');
    }

  } catch (error) {
    console.error('Error calling ChatGPT API:', error);
    throw error;
  }
}