/**
 * Prompts for dynamic post generation service
 */

import {
  TopicAnalysis,
  UserContext,
} from "../types/services/dynamicPostGeneration.types";
import { PostPatterns } from "../types/services/dynamicPostGeneration.types";
import { HIGH_SIMILARITY_THRESHOLD } from "../constants/dynamicPostGeneration.constants";

/**
 * Build enhanced memory context for AI generation
 */
export function buildEnhancedMemoryContext(
  topicAnalysis: TopicAnalysis,
  userContext: UserContext,
  patterns: PostPatterns
): string {
  let memoryContext = `SMART MEMORY SYSTEM - AVOID THESE RECENT PATTERNS:
- Recent opening sentences: ${
    patterns.recentOpeningSentences.slice(0, 3).join(", ") || "None"
  }
- Recent hook types: ${
    patterns.recentHookTypes.slice(0, 3).join(", ") || "None"
  }
- Recent tones: ${patterns.recentTones.slice(0, 3).join(", ") || "None"}
- Recent CTA types: ${patterns.recentCtaTypes.slice(0, 3).join(", ") || "None"}
- Content similarity score: ${patterns.contentSimilarity.toFixed(
    2
  )} (lower is better)

ANTI-REPETITION RULES:
- Don't repeat opening sentences from recent posts
- Vary your hook types and CTA approaches
- Mix up your tone and structure
- Ensure each post feels unique and authentic
- Avoid similar content patterns`;

  if (patterns.contentSimilarity > HIGH_SIMILARITY_THRESHOLD) {
    memoryContext += `\n\n⚠️ HIGH SIMILARITY DETECTED: Recent posts are too similar. Create something completely different!`;
  }

  memoryContext += `\n\nUSER PROFILE:
- Specializes in: ${userContext.position}
- Based in: ${userContext.city}
- Company: ${userContext.companyName}
- Social: ${userContext.socialHandles}

TOPIC CONTEXT:
- This is a ${topicAnalysis.topicType} post
- Sentiment: ${topicAnalysis.sentiment}
- Key focus areas: ${topicAnalysis.keyPoints.join(", ")}`;

  return memoryContext;
}

/**
 * Build main generation prompt
 */
export function buildGenerationPrompt(
  platform: string,
  topicAnalysis: TopicAnalysis,
  userContext: UserContext,
  templateStructure: string,
  templateVariant: number,
  tone: string,
  hookType: string,
  ctaType: string,
  memoryContext: string,
  platformGuidelines: string,
  language?: string
): string {
  // Default to English if language is not provided or empty
  const captionLanguage =
    language && language.trim() ? language.trim() : "English";

  // Language instruction for the prompt
  const languageInstruction =
    captionLanguage === "Spanish"
      ? "Generate all content in Spanish (Español). All text, hashtags, and content must be in Spanish."
      : "Generate all content in English.";

  return `You are an expert social media copywriter specializing in real estate content for ${platform}.

LANGUAGE REQUIREMENT: ${languageInstruction}


VIDEO CONTEXT:
- Topic: ${topicAnalysis.topic}
- Script Hook: ${topicAnalysis.keyPoints[0] || topicAnalysis.topic}
- Script Summary: ${topicAnalysis.keyPoints.join(", ")}
- Agent: ${userContext.name} serving ${userContext.city}
- Specialty: ${userContext.position}

TEMPLATE TO USE:
${templateStructure}

VARIATION REQUIREMENTS (CRITICAL - MUST FOLLOW):
- Template Variant: #${templateVariant} of 5
- Topic Category: ${topicAnalysis.topicType}
- Tone: ${tone}
- Opening Hook Type: ${hookType}
- CTA Type: ${ctaType}

${memoryContext}

CRITICAL INSTRUCTIONS:
1. Write in ${tone} tone appropriate for ${platform}
2. Use ${hookType} style for opening (question, bold statement, story, data, or provocative)
3. Vary sentence structure and rhythm from recent posts
4. CTA must be ${ctaType}-style and feel fresh
5. Make it authentic to ${platform} culture, not templated or robotic
6. Reference ${topicAnalysis.topic} naturally throughout
7. Keep it natural and conversational - this should sound human
8. CRITICAL: Write as ONE FLOWING PARAGRAPH - do NOT use separate sections like [HASHTAGS] or [CONCLUSION]
9. Integrate hashtags naturally within the text flow, not at the end
10. Weave the call-to-action naturally into the content, not as a separate section
11. IMPORTANT: Do NOT include quotation marks ("") in your content. Write clean, natural text without any quotation marks.

CHARACTER LIMIT ENFORCEMENT (MANDATORY):
${(() => {
  const limits: Record<string, number> = {
    instagram: 2000,
    facebook: 5000,
    linkedin: 3000,
    twitter: 280,
    tiktok: 2200,
    youtube: 5000,
  };
  const limit = limits[platform.toLowerCase()] || 1000;
  const targetRanges: Record<string, string> = {
    instagram: "1900-1950",
    facebook: "4900-4950",
    linkedin: "2900-2950",
    twitter: "260-270",
    tiktok: "2100-2150",
    youtube: "4900-4950",
  };
  const targetRange =
    targetRanges[platform.toLowerCase()] ||
    `${Math.max(limit - 150, 0)}-${Math.max(limit - 50, 0)}`;

  // Special handling for Twitter/X - emphasize summarization
  if (platform.toLowerCase() === "twitter") {
    return `⚠️ CRITICAL TWITTER/X REQUIREMENT ⚠️
- Your response MUST be EXACTLY 250-280 characters (count every character including spaces).
- You MUST summarize and condense ALL content to fit within this limit.
- Write your response, then COUNT the characters. If over 280, rewrite it shorter.
- Use shorter words, remove filler words, make it punchy and concise.
- DO NOT exceed 280 characters - content over this limit will be rejected.
- Your final response must be a complete, summarized message within 250-280 characters.`;
  }

  return `- TARGET LENGTH: ${targetRange} characters. ABSOLUTE MAX: ${limit} (must be UNDER, not equal).
- Count characters as you write; stay inside the target range.
- If you approach the target max, FINISH the current sentence and STOP—do NOT start a new sentence.
- If needed, shorten by removing less essential words while keeping the core message.
- DO NOT exceed ${limit} characters—content over max is rejected.
- Verify the final character count is under ${limit} before submitting.`;
})()}

Platform-Specific Guidelines:
${platformGuidelines}

Generate the post now, following the template structure and variation requirements.`;
}

/**
 * Build system message for OpenAI
 */
export function buildSystemMessage(platform: string): string {
  if (platform.toLowerCase() === "twitter") {
    return `You are an expert social media copywriter specializing in real estate content for Twitter/X. You write authentic, engaging posts that are ALWAYS 250-280 characters. You MUST count characters and summarize content to fit this strict limit. Never exceed 280 characters.`;
  }
  return `You are an expert social media copywriter specializing in real estate content for ${platform}. You write authentic, engaging posts that follow platform best practices and avoid repetitive patterns.`;
}
