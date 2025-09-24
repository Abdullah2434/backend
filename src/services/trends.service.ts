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
}

export async function generateRealEstateTrends(): Promise<TrendData[]> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const prompt = `Generate top 5 topic trends to create video ads for real estate in America. Each trend should focus on a different aspect of the real estate industry that would be perfect for video advertising. Provide:

For each of the 5 trends, include:
1. A comprehensive description (5-6 words that look like a title) about current real estate trends in America
2. Key points covering the most important aspects not more than 5 words.

Format your response as JSON array:
[
  {
    "description": "Description for trend 1",
    "keypoints": "Key points for trend 1"
  },
  {
    "description": "Description for trend 2", 
    "keypoints": "Key points for trend 2"
  },
  {
    "description": "Description for trend 3",
    "keypoints": "Key points for trend 3"
  },
  {
    "description": "Description for trend 4",
    "keypoints": "Key points for trend 4"
  },
  {
    "description": "Description for trend 5",
    "keypoints": "Key points for trend 5"
  }
]

Make each trend current, relevant, and engaging for real estate video ads. Focus on different aspects like market trends, technology, investment opportunities, regulatory changes, and consumer behavior that would make compelling video content.`;

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
        max_tokens: 2000,
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
          keypoints: keypoints
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
