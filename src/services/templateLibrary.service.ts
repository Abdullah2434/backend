export interface TemplateStructure {
  platform: string;
  variant: number;
  name: string;
  description: string;
  structure: string;
  guidelines: string;
  bestFor: string[];
}

export class TemplateLibraryService {
  /**
   * Gets template structure for a specific platform and variant
   */
  static getTemplateStructure(
    platform: string,
    variant: number
  ): TemplateStructure {
    const templates = this.getAllTemplates();
    const template = templates.find(
      (t) => t.platform === platform && t.variant === variant
    );

    if (!template) {
      throw new Error(
        `Template not found for platform: ${platform}, variant: ${variant}`
      );
    }

    return template;
  }

  /**
   * Gets all available templates
   */
  static getAllTemplates(): TemplateStructure[] {
    return [
      // YOUTUBE TEMPLATES
      {
        platform: "youtube",
        variant: 1,
        name: "Educational Deep-Dive",
        description:
          "Comprehensive educational content with timestamps and resources",
        bestFor: ["market_update", "industry_analysis"],
        structure: `SYSTEM CONTEXT: You are creating a YouTube description optimized for search and watch time.

STRUCTURE:
[TITLE - 60-70 chars, keyword-rich]: Generate a title that includes main keyword from {{VIDEO_TOPIC}} and creates curiosity.

[DESCRIPTION]:
Paragraph 1 (Hook): Expand on {{SCRIPT_HOOK}} in 2-3 engaging sentences. Create immediate value.
Paragraph 2-3 (Body): Provide detailed breakdown of {{SCRIPT_SUMMARY}}. Use clear sections with line breaks. Include:
- Key statistics or data points
- Practical implications
- Actionable takeaways

[TIMESTAMPS] (if applicable):
0:00 - Introduction
0:30 - [Key point 1 from script]
1:15 - [Key point 2 from script]
2:00 - Conclusion and next steps

[ABOUT SECTION]: I'm {{AGENT_NAME}}, a real estate professional in {{AGENT_CITY}}. I create weekly videos to help buyers and sellers make informed decisions in today's market.

[CONTACT]: 
Email: [placeholder]
Call/Text: [placeholder]
Website: [placeholder]
Serving: {{AGENT_CITY}}

[CTA]: Found this helpful? Hit the like button and subscribe for weekly real estate insights!

Questions about [topic]? Drop them in the comments below.

#RealEstate #{{AGENT_CITY}}RealEstate #[topic-specific keywords]

TAGS (10-15, comma-separated): [Generate mix of broad and specific: real estate, {{AGENT_CITY}} homes, [topic keywords], home buying, housing market, etc.]`,
        guidelines:
          "Description: 300-500 words. Include timestamps, contact info. 3-5 hashtags. SEO-optimize title.",
      },
      {
        platform: "youtube",
        variant: 2,
        name: "Story-Driven",
        description: "Personal anecdote leading to broader market insights",
        bestFor: ["tips", "local_news"],
        structure: `SYSTEM CONTEXT: You are creating a YouTube description that builds connection through storytelling.

STRUCTURE:
[TITLE - 60-70 chars]: Use story-based framing. Example: "What This Buyer Taught Me About [Topic]" or "The [Topic] Lesson I Learned This Week"

[DESCRIPTION]:
Paragraph 1 (Story Hook): Start with a brief client story or personal experience related to {{VIDEO_TOPIC}}. Make it relatable and specific.
Paragraph 2 (The Lesson): Connect the story to {{SCRIPT_SUMMARY}}. What did this experience teach about the current market?
Paragraph 3 (Broader Application): How does this apply to viewers? Expand on {{SCRIPT_SUMMARY}} with practical context.
Paragraph 4 (Takeaway): 2-3 bullet points with actionable insights from the story.

[ABOUT + CONTACT + CTA sections remain the same as Variant 1]

#RealEstateStories #{{AGENT_CITY}} #[topic keywords]

TAGS: Focus on emotional keywords like "real estate advice", "home buying journey", "agent tips"`,
        guidelines:
          "Description: 300-500 words. Story-driven narrative. Include personal context. 3-5 hashtags.",
      },
      {
        platform: "youtube",
        variant: 3,
        name: "Question-Led Analysis",
        description: "Answers pressing questions with data-driven insights",
        bestFor: ["market_update", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create a YouTube description that answers a pressing question.

STRUCTURE:
[TITLE - 60-70 chars]: Frame as a question. Example: "Should You Wait to Buy? Here's What the Data Says" or "Is [Topic] Really Happening?"

[DESCRIPTION]:
Paragraph 1 (The Question): Pose the central question related to {{VIDEO_TOPIC}}. Create curiosity and urgency.
Paragraph 2 (The Data): Present facts, statistics, or trends from {{SCRIPT_SUMMARY}}. Be specific and credible.
Paragraph 3 (The Answer): Clearly answer the opening question with context. What does this mean for buyers/sellers?
Paragraph 4 (What To Do): Actionable guidance based on the answer.

[ABOUT + CONTACT + CTA - same structure]

KEY INSIGHT: [One-line summary of the answer]

#RealEstateAdvice #{{AGENT_CITY}}Market #[topic]

TAGS: Include question-based keywords like "should I buy a house", "when to sell", "real estate questions"`,
        guidelines:
          "Description: 300-500 words. Question-focused. Data-driven. 3-5 hashtags.",
      },
      {
        platform: "youtube",
        variant: 4,
        name: "List-Based Guide",
        description: "Scannable numbered breakdown of key points",
        bestFor: ["tips", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create scannable, list-based YouTube content.

STRUCTURE:
[TITLE - 60-70 chars]: Use numbers. Example: "5 Things About [Topic] Every Buyer Should Know" or "Top 3 [Topic] Mistakes to Avoid"

[DESCRIPTION]:
Opening (Hook): Why this list matters. Connect to {{VIDEO_TOPIC}} urgency.

THE LIST:
1. [Point 1 from {{SCRIPT_SUMMARY}}] Brief explanation (2-3 sentences)
2. [Point 2] Brief explanation
3. [Point 3] Brief explanation
[Continue based on script content]

BOTTOM LINE: One-sentence summary of the key takeaway.

[ABOUT + CONTACT + CTA - same]

TIMESTAMPS:
0:00 - Intro
0:20 - Point #1
1:00 - Point #2
[etc.]

#RealEstateTips #{{AGENT_CITY}} #[topic]

TAGS: "real estate tips", "home buying checklist", "seller advice", [topic-specific]`,
        guidelines:
          "Description: 300-500 words. Numbered list format. Include timestamps. 3-5 hashtags.",
      },
      {
        platform: "youtube",
        variant: 5,
        name: "Contrarian/Hot Take",
        description:
          "Challenges common beliefs with evidence-based counter-narratives",
        bestFor: ["industry_analysis", "tips"],
        structure: `SYSTEM CONTEXT: Create thought-provoking YouTube content that challenges assumptions.

STRUCTURE:
[TITLE - 60-70 chars]: Frame as contrarian. Example: "Why [Common Belief] is Wrong About [Topic]" or "The Truth About [Topic] No One Talks About"

[DESCRIPTION]:
Paragraph 1 (The Myth): State the common belief related to {{VIDEO_TOPIC}}. "Everyone says..."
Paragraph 2 (The Reality): "But here's what's actually happening..." Use {{SCRIPT_SUMMARY}} to present the counter-narrative.
Paragraph 3 (The Evidence): Back it up with data, examples, or market trends. Be credible.
Paragraph 4 (What This Means): Reframe the viewer's understanding. What should they do differently?

REALITY CHECK: [One bold statement summary]

[ABOUT + CONTACT + CTA - same]

#RealEstateTruth #{{AGENT_CITY}}Market #[topic]

TAGS: "real estate myths", "housing market truth", "what agents won't tell you", [topic]`,
        guidelines:
          "Description: 300-500 words. Contrarian perspective. Evidence-based. 3-5 hashtags.",
      },

      // INSTAGRAM TEMPLATES
      {
        platform: "instagram",
        variant: 1,
        name: "Hook-First Story",
        description: "Bold opening leading to relatable story and takeaway",
        bestFor: ["tips", "local_news"],
        structure: `SYSTEM CONTEXT: Create scroll-stopping Instagram content that leads with emotion.

CAPTION STRUCTURE:
Line 1-2 (HOOK - make it bold): Reframe {{SCRIPT_HOOK}} into a punchy, emoji-enhanced statement that stops the scroll. Example: "This just changed everything for buyers." or "Here's what 90% of sellers don't know..."

[Blank line]

Lines 3-6 (STORY): Share a brief story or scenario related to {{VIDEO_TOPIC}}. Make it relatable. Use "you" language. Keep sentences short (10-15 words max).

[Blank line]

Lines 7-9 (TAKEAWAY): What's the lesson from {{SCRIPT_SUMMARY}}? What should followers understand? Use 2-3 bullet points with emojis as bullets.

[Blank line]

Line 10 (CTA): Action-oriented. Examples:
- "Save this for later 💾"
- "Tag someone shopping for a home 🏠"
- "DM me 'rates' for a custom breakdown"

— {{AGENT_NAME}} | {{AGENT_CITY}} Real Estate
Helping you win in this market

HASHTAGS (5-8 in caption): #{{AGENT_CITY}}RealEstate #RealEstateTips #HomeBuying #[topic-specific from {{VIDEO_TOPIC}}]

FIRST COMMENT (20-25 additional hashtags): Mix of location, broad, niche, and topic-specific: #{{AGENT_CITY}}Homes #{{AGENT_CITY}}Realtor #RealEstateAgent #HousingMarket #FirstTimeHomeBuyer #RealEstateLife #HomeSellers #RealEstateInvesting #[15-20 more relevant tags]`,
        guidelines:
          "Caption: 150-300 words. Lead with hook. Use line breaks. 5-8 hashtags in caption, 20-25 in comment.",
      },
      {
        platform: "instagram",
        variant: 2,
        name: "Question-Led Engagement",
        description: "Direct question to drive comments and discussion",
        bestFor: ["market_update", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create engagement-focused Instagram content.

CAPTION STRUCTURE:
Line 1 (QUESTION): Turn {{VIDEO_TOPIC}} into a direct question. Example: "Should you wait to buy? 🤔"

[Blank line]

Lines 2-5 (SHORT ANSWER): Quick breakdown of {{SCRIPT_SUMMARY}} in 3-4 sentences. Use contractions. Be conversational. One emoji per sentence max.

[Blank line]

Lines 6-7 (CONTEXT): Why this matters right now. Create urgency or relevance.

[Blank line]

Line 8 (CTA - discussion-focused): "What would you do? Drop your thoughts below 👇" or "Questions? I'm answering all of them today 💬"

— {{AGENT_NAME}} | {{AGENT_CITY}} Real Estate
Your local market expert

HASHTAGS (6-8): #{{AGENT_CITY}}RealEstate #RealEstateAdvice #[topic-specific]

FIRST COMMENT: [20-25 hashtags as in Variant 1]`,
        guidelines:
          "Caption: 150-300 words. Question-focused. Discussion-driven. 5-8 hashtags in caption, 20-25 in comment.",
      },
      {
        platform: "instagram",
        variant: 3,
        name: "List-Based Value",
        description:
          "Numbered breakdown of key points with actionable takeaways",
        bestFor: ["tips", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create scannable, value-packed Instagram content.

CAPTION STRUCTURE:
Line 1 (VALUE HOOK): "3 things about [{{VIDEO_TOPIC}}] you need to know 📋" or "The [topic] breakdown, made simple:"

[Blank line]

Lines 2-8 (NUMBERED LIST): Break down {{SCRIPT_SUMMARY}} into 3-4 digestible points:
1️⃣ [Point one - 1-2 sentences]
2️⃣ [Point two - 1-2 sentences]
3️⃣ [Point three - 1-2 sentences]

[Blank line]

Line 9 (BOTTOM LINE): One sentence summary. "Bottom line: [key takeaway]"

[Blank line]

Line 10 (CTA): Save or share focused. "Save this so you don't forget 💾" or "Send this to someone house hunting 🏠"

— {{AGENT_NAME}} | {{AGENT_CITY}} Real Estate

HASHTAGS (5-7): #RealEstateTips #{{AGENT_CITY}} #[topic]

FIRST COMMENT: [hashtag block]`,
        guidelines:
          "Caption: 150-300 words. Numbered list format. Value-focused. 5-8 hashtags in caption, 20-25 in comment.",
      },
      {
        platform: "instagram",
        variant: 4,
        name: "Behind-the-Scenes",
        description: "Insider perspective on market observations and trends",
        bestFor: ["local_news", "market_update"],
        structure: `SYSTEM CONTEXT: Create authentic, insider-perspective Instagram content.

CAPTION STRUCTURE:
Line 1-2 (INSIDER HOOK): "Here's what I'm seeing in {{AGENT_CITY}} right now..." or "Real talk from the field 🏠"

[Blank line]

Lines 3-7 (OBSERVATIONS): Share 2-3 specific things you're noticing related to {{VIDEO_TOPIC}}. Use "I'm seeing...", "My clients are...", "The market is..." Personal, first-person perspective.

[Blank line]

Lines 8-9 (WHAT IT MEANS): Connect observations to {{SCRIPT_SUMMARY}}. What should followers take away?

[Blank line]

Line 10 (CTA - collaborative): "What are you seeing? Any questions? 💬" or "Let's talk strategy - DM me 📱"

— {{AGENT_NAME}} | Real Estate in {{AGENT_CITY}}

HASHTAGS: #{{AGENT_CITY}}Market #RealEstateInsights #[topic]

FIRST COMMENT: [hashtag block]`,
        guidelines:
          "Caption: 150-300 words. Insider perspective. First-person narrative. 5-8 hashtags in caption, 20-25 in comment.",
      },
      {
        platform: "instagram",
        variant: 5,
        name: "Myth-Busting",
        description: "Corrects common misconceptions with clear explanations",
        bestFor: ["tips", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create corrective, educational Instagram content.

CAPTION STRUCTURE:
Line 1 (THE MYTH): "Everyone thinks [common belief about {{VIDEO_TOPIC}}]..." or "Myth: [false belief] ❌"

[Blank line]

Line 2 (THE REALITY): "But here's what's really happening ✅" or "Reality check:"

[Blank line]

Lines 3-6 (THE TRUTH): Break down {{SCRIPT_SUMMARY}} to correct the misconception. Be clear and direct. Use data or examples if applicable.

[Blank line]

Lines 7-8 (WHY IT MATTERS): Why does this myth hurt buyers/sellers? What should they do instead?

[Blank line]

Line 9 (CTA): "Share this with someone who needs to hear it 📤" or "What other myths should I bust? 💬"

— {{AGENT_NAME}} | {{AGENT_CITY}} Real Estate
Keeping it real since [year]

HASHTAGS: #RealEstateMyths #{{AGENT_CITY}} #[topic]

FIRST COMMENT: [hashtag block]`,
        guidelines:
          "Caption: 150-300 words. Myth-busting format. Educational tone. 5-8 hashtags in caption, 20-25 in comment.",
      },

      // TIKTOK TEMPLATES
      {
        platform: "tiktok",
        variant: 1,
        name: "Question Hook",
        description: "Direct question leading to ultra-brief answer",
        bestFor: ["tips", "market_update"],
        structure: `SYSTEM CONTEXT: Create TikTok content optimized for maximum watch time (short, punchy).

CAPTION (100-150 chars MAX): [Turn {{VIDEO_TOPIC}} into a direct question]
Example formats:
- "Why did [topic]? 🤔"
- "Should you [action related to topic]? Here's the truth."
- "Is [topic] really happening? Let me explain."

Add 1-2 relevant emojis.

HASHTAGS (3-5 in caption): #RealEstate #{{AGENT_CITY}} #[topic keyword] #RealEstateTips #fyp

NO LONG DESCRIPTIONS. TikTok users don't read - they watch and scroll.`,
        guidelines:
          "Caption: 100-150 chars MAX. Ultra-punchy. 3-5 hashtags. Always include #fyp.",
      },
      {
        platform: "tiktok",
        variant: 2,
        name: "Bold Statement",
        description: "Controversial or surprising claim to grab attention",
        bestFor: ["industry_analysis", "tips"],
        structure: `SYSTEM CONTEXT: Create attention-grabbing TikTok content.

CAPTION (100-150 chars): [Make a bold claim from {{SCRIPT_SUMMARY}}]
Example formats:
- "[Bold statement about {{VIDEO_TOPIC}}] and here's why 🔥"
- "Everyone's doing [X] wrong. Let me explain."
- "This changed everything for buyers. 💡"

1-2 emojis max.

HASHTAGS (3-5): #RealEstate #{{AGENT_CITY}} #RealEstateTok #[topic] #fyp`,
        guidelines:
          "Caption: 100-150 chars MAX. Bold claims. Attention-grabbing. 3-5 hashtags. Always include #fyp.",
      },
      {
        platform: "tiktok",
        variant: 3,
        name: "Here's What...",
        description: "Direct statement of what you're about to explain",
        bestFor: ["tips", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create clear, educational TikTok content.

CAPTION (100-150 chars): "Here's what [{{VIDEO_TOPIC}}] means for you" or "What you need to know about [topic] 📚"
Keep it straightforward and informative.

HASHTAGS (3-5): #RealEstate #{{AGENT_CITY}}RealEstate #HomeBuying #[topic] #fyp`,
        guidelines:
          "Caption: 100-150 chars MAX. Educational format. Clear and direct. 3-5 hashtags. Always include #fyp.",
      },
      {
        platform: "tiktok",
        variant: 4,
        name: "POV/Scenario",
        description: "Relatable scenario using POV format",
        bestFor: ["tips", "local_news"],
        structure: `SYSTEM CONTEXT: Create relatable TikTok content using POV format.

CAPTION (100-150 chars): "POV: [scenario related to {{VIDEO_TOPIC}}]"
Examples:
- "POV: You just found out [topic detail] 😱"
- "POV: You're a first-time buyer and [situation from topic] 🏠"

1 emoji.

HASHTAGS (3-5): #RealEstatePOV #{{AGENT_CITY}} #[topic] #RealEstate #fyp`,
        guidelines:
          "Caption: 100-150 chars MAX. POV format. Relatable scenarios. 3-5 hashtags. Always include #fyp.",
      },
      {
        platform: "tiktok",
        variant: 5,
        name: "Numbers/Stats",
        description: "Lead with surprising number or statistic",
        bestFor: ["market_update", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create data-driven TikTok content.

CAPTION (100-150 chars): [Lead with surprising stat from {{VIDEO_TOPIC}}]
Example:
- "[Number]% of buyers don't know this 📊"
- "This number just changed for [topic] 🔢"

HASHTAGS (3-5): #RealEstateData #{{AGENT_CITY}}Market #RealEstate #[topic] #fyp`,
        guidelines:
          "Caption: 100-150 chars MAX. Data-driven. Surprising stats. 3-5 hashtags. Always include #fyp.",
      },

      // FACEBOOK TEMPLATES
      {
        platform: "facebook",
        variant: 1,
        name: "Community Update",
        description:
          "Friendly opening with local market news and engagement invitation",
        bestFor: ["local_news", "market_update"],
        structure: `SYSTEM CONTEXT: Create community-focused Facebook content.

POST TEXT (50-100 words):
Opening (1-2 sentences): "Hey {{AGENT_CITY}} friends," or "Quick update for local buyers and sellers:"
Friendly, approachable tone.

Body (2-3 sentences): Break down {{SCRIPT_SUMMARY}} in plain language. Avoid jargon. Focus on "what this means for you."

CTA (community-focused): "What questions do you have? Drop them below 👇" or "Tag someone who needs to see this!"

Emoji use: 2-3 total (not excessive).

HASHTAGS (optional, 2-3 max): #{{AGENT_CITY}}RealEstate #RealEstate

NOTE: Facebook prioritizes native video. Keep text conversational, not salesy.`,
        guidelines:
          "50-100 words. Friendly tone. 2-3 emojis. Ask questions. 1-3 hashtags optional.",
      },
      {
        platform: "facebook",
        variant: 2,
        name: "Question-to-Community",
        description: "Ask audience directly to drive discussion and comments",
        bestFor: ["market_update", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create discussion-driving Facebook content.

POST TEXT (40-80 words):
Line 1 (QUESTION): Ask directly about {{VIDEO_TOPIC}}. Example: "Are you waiting to buy, or jumping in now? 🤔"

Lines 2-4 (BRIEF CONTEXT): 1-2 sentences on {{SCRIPT_SUMMARY}} to frame the question.

Line 5 (CTA): "I'd love to hear your thoughts - what's your take? 💬"
Conversational, opinion-seeking tone.

HASHTAGS: Optional, 1-2 max`,
        guidelines:
          "40-80 words. Question-focused. Discussion-driven. 1-2 hashtags optional.",
      },
      {
        platform: "facebook",
        variant: 3,
        name: "Just Learned...",
        description: "Personal discovery shared with enthusiasm",
        bestFor: ["market_update", "local_news"],
        structure: `SYSTEM CONTEXT: Create authentic, learning-focused Facebook content.

POST TEXT (50-90 words):
Opening: "I just learned something about [{{VIDEO_TOPIC}}] that I had to share..."

Body: Explain {{SCRIPT_SUMMARY}} as if sharing news with friends. Enthusiastic but not overhyped.

Closing: "Thought you'd want to know! Share this if it's helpful 📤"
Friendly, genuine tone.

HASHTAGS: 1-2 max`,
        guidelines:
          "50-90 words. Learning-focused. Enthusiastic tone. 1-2 hashtags max.",
      },
      {
        platform: "facebook",
        variant: 4,
        name: "Here's the Deal",
        description: "Straightforward explainer with bottom line and CTA",
        bestFor: ["tips", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create clear, no-nonsense Facebook content.

POST TEXT (60-100 words):
Opening: "Here's the deal with [{{VIDEO_TOPIC}}]:" or "Let me break down [topic] for you:"

Body: Straight-talk explanation of {{SCRIPT_SUMMARY}}. No fluff. Clear and direct.

Bottom Line: "What you need to know: [one-sentence takeaway]"

CTA: "Questions? Drop them below or DM me directly. 💬"
Professional but accessible tone.

HASHTAGS: Optional, 1-2`,
        guidelines:
          "60-100 words. Straight-talk format. Clear and direct. 1-2 hashtags optional.",
      },
      {
        platform: "facebook",
        variant: 5,
        name: "Local Story",
        description:
          "Local angle with broader relevance and community engagement",
        bestFor: ["local_news", "tips"],
        structure: `SYSTEM CONTEXT: Create locally-relevant Facebook content.

POST TEXT (50-100 words):
Opening: "Something's happening in {{AGENT_CITY}} that affects [buyers/sellers]..."

Body: Connect {{VIDEO_TOPIC}} to local context. Make {{SCRIPT_SUMMARY}} feel specific to this community.

Closing: "If you're in the area, this matters. Let me know if you have questions! 🏠"
Community-focused, helpful tone.

HASHTAGS: #{{AGENT_CITY}} #{{AGENT_CITY}}RealEstate`,
        guidelines:
          "50-100 words. Local focus. Community-oriented. 1-2 hashtags.",
      },

      // LINKEDIN TEMPLATES
      {
        platform: "linkedin",
        variant: 1,
        name: "Industry Insight",
        description:
          "Professional observation with data, trends, and implications",
        bestFor: ["market_update", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create thought leadership content for LinkedIn.

POST TEXT (150-250 words):
Opening (1-2 sentences): Professional observation about {{VIDEO_TOPIC}}. Example: "The real estate landscape just shifted, and here's what it means for my clients."

Body (3-4 paragraphs with line breaks):
Paragraph 1 - What's Happening: Explain {{SCRIPT_SUMMARY}} with industry context. Use data if available.
Paragraph 2 - Why It Matters: Industry implications. Broader market context.
Paragraph 3 - What To Do: Actionable takeaway for professionals or clients.
(Each paragraph: 2-3 sentences, line break between)

Personal Context (1 sentence): "In the {{AGENT_CITY}} market specifically, I'm seeing [relevant local angle]."

CTA (professional, consultative): "If you're navigating this market, let's connect - I'd be happy to share insights specific to your situation."

Sign-off: — {{AGENT_NAME}} Real Estate Professional | {{AGENT_CITY}}
Helping clients make informed decisions in an evolving market

HASHTAGS (3-5, professional): #RealEstate #{{AGENT_CITY}} #RealEstateInsights #HousingMarket #[topic from {{VIDEO_TOPIC}}]

TONE: Professional, analytical, third-person observations with first-person perspective
NO EMOJIS`,
        guidelines:
          "150-250 words. Professional tone. NO EMOJIS. Industry insights. 3-5 hashtags.",
      },
      {
        platform: "linkedin",
        variant: 2,
        name: "Personal Story/Lesson",
        description: "Client anecdote leading to broader market application",
        bestFor: ["tips", "local_news"],
        structure: `SYSTEM CONTEXT: Create relatable, narrative-driven LinkedIn content.

POST TEXT (150-250 words):
Opening (1-2 sentences): "A conversation with a client this week reminded me of something important about {{VIDEO_TOPIC}}..."

Story (2-3 paragraphs): Brief client anecdote (anonymized) or personal market experience. Connect to {{SCRIPT_SUMMARY}}. Make it specific but relatable.

Lesson (1 paragraph): "What this taught me: [key insight from {{SCRIPT_SUMMARY}}]"

Broader Application (1 paragraph): How this lesson applies to the current market or industry at large.

CTA (consultative): "What are you seeing in your market? I'd love to hear your perspective."

Sign-off: — {{AGENT_NAME}} Real Estate Professional | {{AGENT_CITY}}

HASHTAGS (3-5): #RealEstate #{{AGENT_CITY}} #RealEstateLife #[topic]

TONE: Relatable, first-person narrative, professional but personable
NO EMOJIS`,
        guidelines:
          "150-250 words. Story-driven. Professional narrative. NO EMOJIS. 3-5 hashtags.",
      },
      {
        platform: "linkedin",
        variant: 3,
        name: "Question-Led Analysis",
        description:
          "Provocative question with data-driven answer and takeaway",
        bestFor: ["market_update", "industry_analysis"],
        structure: `SYSTEM CONTEXT: Create analytical, question-based LinkedIn content.

POST TEXT (150-250 words):
Opening (1 sentence): Provocative question about {{VIDEO_TOPIC}}. Example: "Are buyers waiting too long? Here's what the data shows..."

Analysis (3 paragraphs):
Paragraph 1 - The Data: Present facts/trends from {{SCRIPT_SUMMARY}}. Be specific and credible.
Paragraph 2 - The Answer: Directly answer the opening question with context.
Paragraph 3 - What It Means: Implications for buyers, sellers, or the industry.

Takeaway (1 sentence): "The key insight: [one-line summary]"

CTA (thought leadership): "Thoughts? What are you advising your clients in this environment?"

Sign-off: — {{AGENT_NAME}} {{AGENT_CITY}} Real Estate

HASHTAGS (3-5): #RealEstateAnalysis #{{AGENT_CITY}}Market #HousingTrends #[topic]

TONE: Analytical, data-driven, consultative
NO EMOJIS`,
        guidelines:
          "150-250 words. Question-based analysis. Data-driven. NO EMOJIS. 3-5 hashtags.",
      },
      {
        platform: "linkedin",
        variant: 4,
        name: "Market Observations",
        description: "Numbered breakdown of current market shifts and trends",
        bestFor: ["market_update", "local_news"],
        structure: `SYSTEM CONTEXT: Create structured, scannable LinkedIn content.

POST TEXT (150-250 words):
Opening (1 sentence): "3 shifts happening in the {{AGENT_CITY}} market right now:"

Numbered List:
1. [Observation 1 from {{SCRIPT_SUMMARY}}] Brief explanation (2-3 sentences)
2. [Observation 2] Brief explanation
3. [Observation 3] Brief explanation

Summary (1 paragraph): What these shifts mean collectively. Connect to {{VIDEO_TOPIC}}.

Professional Context: "As a real estate professional in {{AGENT_CITY}}, I'm watching these trends closely to serve my clients better."

CTA (collaborative): "What are you noticing in your market? Let's compare notes."

Sign-off: — {{AGENT_NAME}} Real Estate Professional | {{AGENT_CITY}}

HASHTAGS (3-5): #RealEstate #MarketTrends #{{AGENT_CITY}} #[topic]

TONE: Structured, observational, professional
NO EMOJIS`,
        guidelines:
          "150-250 words. Numbered list format. Market observations. NO EMOJIS. 3-5 hashtags.",
      },
      {
        platform: "linkedin",
        variant: 5,
        name: "Contrarian/Unpopular Opinion",
        description:
          "Challenges conventional wisdom with evidence-based counter-narrative",
        bestFor: ["industry_analysis", "tips"],
        structure: `SYSTEM CONTEXT: Create thought-provoking, contrarian LinkedIn content.

POST TEXT (150-250 words):
Opening (1-2 sentences): "Unpopular opinion: [contrarian take on {{VIDEO_TOPIC}}]" or "Everyone says [X], but here's what's really happening..."

Counter-Narrative (2-3 paragraphs):
Paragraph 1 - The Common Belief: What most people think about {{VIDEO_TOPIC}}.
Paragraph 2 - The Reality: Present counter-evidence from {{SCRIPT_SUMMARY}}. Be bold but credible.
Paragraph 3 - Why It Matters: What this means for the industry or clients.

Perspective (1 sentence): "In my experience with {{AGENT_CITY}} clients, this contrarian view has proven accurate."

CTA (discussion-focused): "Agree? Disagree? I'm interested in other perspectives - let me know what you think."

Sign-off: — {{AGENT_NAME}} Real Estate Professional | {{AGENT_CITY}}
Challenging conventional wisdom in real estate

HASHTAGS (3-5): #RealEstate #UnpopularOpinion #{{AGENT_CITY}} #[topic]

TONE: Bold, opinion-driven, professional credibility
NO EMOJIS`,
        guidelines:
          "150-250 words. Contrarian perspective. Opinion-driven. NO EMOJIS. 3-5 hashtags.",
      },
    ];
  }

  /**
   * Gets platform-specific writing guidelines
   */
  static getPlatformGuidelines(platform: string): string {
    const guidelines: { [key: string]: string } = {
      youtube:
        "Description: 300-500 words. Include timestamps, contact info. 3-5 hashtags. SEO-optimize title.",
      instagram:
        "Caption: 150-300 words. Lead with hook. Use line breaks. 5-8 hashtags in caption, 20-25 in comment.",
      tiktok:
        "Caption: 100-150 chars MAX. Ultra-punchy. 3-5 hashtags. Always include #fyp.",
      facebook:
        "50-100 words. Friendly tone. 2-3 emojis. Ask questions. 1-3 hashtags optional.",
      linkedin:
        "150-250 words. Professional. NO EMOJIS. Industry insights. 3-5 hashtags.",
    };
    return guidelines[platform] || "";
  }

  /**
   * Gets all templates for a specific platform
   */
  static getTemplatesByPlatform(platform: string): TemplateStructure[] {
    return this.getAllTemplates().filter(
      (template) => template.platform === platform
    );
  }

  /**
   * Gets templates that work best for a specific topic category
   */
  static getTemplatesByTopicCategory(
    topicCategory: string
  ): TemplateStructure[] {
    return this.getAllTemplates().filter((template) =>
      template.bestFor.includes(topicCategory)
    );
  }
}

export default TemplateLibraryService;
