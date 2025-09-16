import axios from 'axios';
import Topic from '../models/Topic';
import dotenv from 'dotenv';
import { connectMongo } from '../config/mongoose';
dotenv.config();

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Define available topics array (matches the enum in Topic model)
const AVAILABLE_TOPICS: string[] = ['real_estate'];
// Future: Add more topics here when you expand the enum
// const AVAILABLE_TOPICS: string[] = ['real_estate', 'technology', 'healthcare'];

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface TopicData {
  description: string;
  keypoints: string;
}

export async function generateAndStoreTopicData() {
  try {
    await connectMongo();
    
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY environment variable is not set');
      return;
    }

    console.log(`Starting data generation for ${AVAILABLE_TOPICS.length} topics: ${AVAILABLE_TOPICS.join(', ')}`);
    
    // Delete ALL existing topics first
    const deleteResult = await Topic.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing topic records`);
    
    // Generate data for each topic in the array
    for (const topic of AVAILABLE_TOPICS) {
      console.log(`\n--- Processing ${topic} ---`);
      
      // Generate all 5 documents for this topic in one API call
      const topicDataArray = await generateMultipleTopicDataWithGemini(topic);
      
      if (!topicDataArray || topicDataArray.length === 0) {
        console.error(`Failed to generate topic data from Gemini AI for ${topic}`);
        continue; // Skip this topic and continue with others
      }
      
      // Create all documents for this topic
      for (let i = 0; i < topicDataArray.length; i++) {
        const topicData = topicDataArray[i];
        
        await Topic.create({
          topic,
          description: topicData.description,
          keypoints: topicData.keypoints
        });
        console.log(`  ✓ Created document ${i + 1}/${topicDataArray.length} for ${topic}`);
      }
      
      console.log(`✓ Completed generating ${topicDataArray.length} documents for ${topic}`);
      
      // Add a delay between topics to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n✅ All topics data generation complete!');
  } catch (error) {
    console.error('Error generating topic data:', error);
  }
}

async function generateMultipleTopicDataWithGemini(topic: string): Promise<TopicData[]> {
  try {
    // Prompt to generate 5 different documents for the topic
    const prompt = `Generate 5 different latest trending ${topic} content pieces. Each should focus on a different aspect of the ${topic} industry. Provide:

For each of the 5 pieces, include:
1. A comprehensive description (5-6 words that look like a title) about current ${topic} trends
2. Key points covering the most important aspects not more than 5 words.

Format your response as JSON array:
[
  {
    "description": "Description for piece 1",
    "keypoints": "Key points for piece 1"
  },
  {
    "description": "Description for piece 2", 
    "keypoints": "Key points for piece 2"
  },
  {
    "description": "Description for piece 3",
    "keypoints": "Key points for piece 3"
  },
  {
    "description": "Description for piece 4",
    "keypoints": "Key points for piece 4"
  },
  {
    "description": "Description for piece 5",
    "keypoints": "Key points for piece 5"
  }
]

Make each piece current, relevant, and engaging for ${topic} professionals and stakeholders. Focus on different aspects like market trends, technology, investment opportunities, regulatory changes, and consumer behavior.`;

    const response = await axios.post<GeminiResponse>(
      GEMINI_API_URL,
      {
        contents: [
          {
            parts: [
              {
                text: `You are a ${topic} market analyst providing current, accurate, and engaging market insights. ${prompt}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2000,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        }
      }
    );

    const content = response.data.candidates[0]?.content?.parts[0]?.text;
    if (!content) {
      console.error('No content received from Gemini AI');
      return [];
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
        console.error('Expected array response from Gemini AI');
        return [];
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
      console.error('Error parsing Gemini AI response:', parseError);
      console.log('Raw response:', content);
      return [];
    }

  } catch (error) {
    console.error('Error calling Gemini AI API:', error);
    return [];
  }
}

// For manual run/testing
if (require.main === module) {
  // Generate all topics defined in AVAILABLE_TOPICS array
  generateAndStoreTopicData();
}
