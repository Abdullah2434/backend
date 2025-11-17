/**
 * Types for generateTopicData cron job
 */

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface TopicData {
  description: string;
  keypoints: string;
}

export interface TopicDataGenerationResult {
  success: boolean;
  topic: string;
  generatedCount: number;
  error?: string;
}

export interface GenerateTopicDataSummary {
  totalTopics: number;
  successfulTopics: number;
  failedTopics: number;
  totalGenerated: number;
  errors: string[];
}

export interface GenerateTopicDataConfig {
  maxRetries: number;
  retryInitialDelayMs: number;
  overallTimeoutMs: number;
  apiTimeoutMs: number;
  databaseTimeoutMs: number;
  delayBetweenTopicsMs: number;
}

export interface OpenAIRequestPayload {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature: number;
  max_tokens: number;
}

