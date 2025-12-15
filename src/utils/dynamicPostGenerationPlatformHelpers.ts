/**
 * Platform-specific helper functions for dynamic post generation
 */

import {
  PLATFORM_CHARACTER_LIMITS,
  PLATFORM_HASHTAG_COUNTS,
} from "../constants/dynamicPostGeneration.constants";

/**
 * Get platform-specific guidelines
 */
export function getPlatformGuidelines(platform: string): string {
  const guidelines: Record<string, string> = {
    youtube: `
- TARGET 4900-4950 characters. ABSOLUTE MAX: 5000 (stay UNDER).
- Description should be comprehensive but within 5000 character limit
- Include timestamps if video has clear sections
- Always include contact info and about section
- Use 3-5 hashtags max
- SEO-optimize title (60-70 chars)
- Include clear CTA for likes, comments, subscribes
- Count characters as you write - stop before 5000`,

    instagram: `
- TARGET 1900-1950 characters. ABSOLUTE MAX: 2000 (stay UNDER).
- Caption should be engaging but within 2000 character limit
- Lead with strong hook in first 1-2 lines
- Use line breaks for readability (blank lines between sections)
- Use emojis strategically (2-3 per section, not excessive)
- 5-8 hashtags in caption, 20-25 in first comment
- CTA should encourage saves, tags, or DMs
- Conversational "you" language
- Count characters as you write - stop before 2000`,

    tiktok: `
- TARGET 2100-2150 characters. ABSOLUTE MAX: 2200 (stay UNDER).
- Ultra-punchy, scroll-stopping hook
- 3-5 hashtags only
- 1-2 emojis max
- No long paragraphs - keep it snappy
- Always include #fyp
- Count characters as you write - stop before 2200`,

    facebook: `
- TARGET 4900-4950 characters. ABSOLUTE MAX: 5000 (stay UNDER).
- Friendly, community-focused tone
- 2-3 emojis total (moderate use)
- Ask questions to drive comments
- 1-3 hashtags max (optional)
- Focus on local community connection
- Count characters as you write - stop before 5000`,

    linkedin: `
- TARGET 2900-2950 characters. ABSOLUTE MAX: 3000 (stay UNDER).
- Professional tone, stay within 3000 character limit
- Use paragraphs with line breaks (not walls of text)
- NO EMOJIS (maintain professional credibility)
- First-person or analytical perspective
- Industry insights and thought leadership
- 3-5 professional hashtags
- CTA should be consultative or discussion-focused
- Count characters as you write - stop before 3000`,

    twitter: `
- TARGET 260-270 characters. ABSOLUTE MAX: 280 (stay UNDER).
- Keep it concise and punchy - must be under 280 characters
- Use trending topics when relevant
- 2-5 hashtags
- Engaging, conversational tone
- Include questions or calls to action
- Use line breaks for readability
- Count characters as you write - stop before 280`,
  };

  return guidelines[platform] || "";
}

/**
 * Get platform-specific optimizations
 */
export function getPlatformOptimizations(platform: string): string {
  const optimizations: Record<string, string> = {
    instagram: `
INSTAGRAM OPTIMIZATION:
- Visual-first content with strong visual appeal
- Use relevant hashtags (5-8 hashtags)
- Include emojis for engagement
- Keep descriptions concise but engaging
- Focus on lifestyle and aspirational content
- Use line breaks for readability
- Include location tags when relevant
- Encourage user-generated content`,

    facebook: `
FACEBOOK OPTIMIZATION:
- Community-focused, conversational tone
- Encourage discussion and comments
- Use 3-5 relevant hashtags
- Include local community references
- Ask questions to drive engagement
- Share personal insights and experiences
- Use longer-form content (up to 400 characters)
- Focus on local market insights`,

    linkedin: `
LINKEDIN OPTIMIZATION:
- Professional, thought-leadership tone
- Industry insights and expertise
- Use 2-3 professional hashtags
- Focus on business and career development
- Include data and statistics
- Share professional experiences
- Encourage professional networking
- Avoid excessive emojis`,

    tiktok: `
TIKTOK OPTIMIZATION:
- Ultra-short, scroll-stopping content
- Use trending hashtags (5-7 hashtags)
- Heavy emoji usage for engagement
- Quick, actionable tips
- Behind-the-scenes content
- Use trending audio concepts
- Focus on quick wins and tips
- Encourage shares and saves`,

    youtube: `
YOUTUBE OPTIMIZATION:
- Educational, comprehensive content
- Detailed explanations and insights
- Use 8-12 relevant hashtags
- Include timestamps for longer content
- Focus on tutorials and guides
- Encourage subscriptions
- Include call-to-action for engagement
- Professional but accessible tone`,

    twitter: `
TWITTER OPTIMIZATION:
- Concise, engaging content
- Use trending hashtags (2-5 hashtags)
- Quick insights and tips
- Encourage retweets and replies
- Use threads for longer content
- Include relevant mentions
- Focus on real-time updates`,
  };

  return optimizations[platform] || "";
}

/**
 * Get template structure string
 */
export function getTemplateStructure(template: any, platform: string): string {
  return `SYSTEM CONTEXT: ${template.description}

STRUCTURE:
${template.structure.description.template}

HOOK TYPE: ${template.structure.hook.type}
HOOK TEMPLATE: ${template.structure.hook.template}
HOOK EXAMPLES: ${template.structure.hook.examples.join(", ")}

KEY POINTS TEMPLATE: ${template.structure.keyPoints.template}
MAX POINTS: ${template.structure.keyPoints.maxPoints}

CONCLUSION CTA TYPE: ${template.structure.conclusion.ctaType}
CONCLUSION TEMPLATE: ${template.structure.conclusion.template}
CONCLUSION EXAMPLES: ${template.structure.conclusion.examples.join(", ")}

TONE: ${template.tone}
PLATFORM OPTIMIZATIONS:
- Max Length: ${template.platformOptimizations.maxLength} characters
- Hashtag Count: ${template.platformOptimizations.hashtagCount}
- Emoji Usage: ${template.platformOptimizations.emojiUsage}
- Line Breaks: ${template.platformOptimizations.lineBreaks ? "Yes" : "No"}
- Call to Action: ${template.platformOptimizations.callToAction}`;
}

/**
 * Get character limits for platform
 */
export function getPlatformCharacterLimits(platform: string): {
  min: number;
  max: number;
} {
  return (
    PLATFORM_CHARACTER_LIMITS[
      platform as keyof typeof PLATFORM_CHARACTER_LIMITS
    ] || { min: 100, max: 300 }
  );
}

/**
 * Get hashtag counts for platform
 */
export function getPlatformHashtagCounts(platform: string): {
  min: number;
  max: number;
} {
  return (
    PLATFORM_HASHTAG_COUNTS[
      platform as keyof typeof PLATFORM_HASHTAG_COUNTS
    ] || { min: 3, max: 5 }
  );
}
