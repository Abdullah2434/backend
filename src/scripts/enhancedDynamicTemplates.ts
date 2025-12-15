import mongoose from "mongoose";
import ContentTemplate from "../models/ContentTemplate";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Enhanced Templates matching the detailed specification
const enhancedTemplates = [
  // ===== YOUTUBE TEMPLATES (5 variants) =====
  {
    platform: "youtube",
    variant: 1,
    name: "Educational Deep-Dive",
    description:
      "Comprehensive educational content with timestamps and resources",
    structure: {
      hook: {
        type: "data",
        template:
          "Generate a title that includes main keyword from {{VIDEO_TOPIC}} and creates curiosity.",
        examples: [
          "Should You Wait to Buy? Here's What the Data Says",
          "The Real Estate Market Just Shifted - Here's What It Means",
        ],
      },
      description: {
        template: `[DESCRIPTION]:
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

[ABOUT SECTION]:
I'm {{AGENT_NAME}}, a real estate professional in {{AGENT_CITY}}. I create weekly videos to help buyers and sellers make informed decisions in today's market.

[CONTACT]:
Email: [placeholder]
Call/Text: [placeholder]
Website: [placeholder]
Serving: {{AGENT_CITY}}

[CTA]:
Found this helpful? Hit the like button
Questions about [topic]? Drop them in the comments
Subscribe for weekly real estate insights
#RealEstate #{{AGENT_CITY}}RealEstate #[topic-specific keywords]`,
        maxLength: 500,
      },
      keyPoints: {
        template:
          "TAGS (10-15, comma-separated):\n[Generate mix of broad and specific: real estate, {{AGENT_CITY}} homes, [topic keywords], home buying, housing market, etc.]",
        maxPoints: 15,
      },
      conclusion: {
        ctaType: "action",
        template: "Subscribe for weekly real estate insights",
        examples: [
          "Subscribe for weekly real estate insights",
          "Hit the like button if this helped you",
        ],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 500,
      hashtagCount: 15,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Subscribe for weekly insights",
    },
    isActive: true,
  },
  {
    platform: "youtube",
    variant: 2,
    name: "Story-Driven",
    description:
      "Personal anecdotes and client stories with broader applications",
    structure: {
      hook: {
        type: "story",
        template:
          'Use story-based framing. Example: "What This Buyer Taught Me About [Topic]" or "The [Topic] Lesson I Learned This Week"',
        examples: [
          "What This Buyer Taught Me About Market Timing",
          "The Real Estate Lesson I Learned This Week",
        ],
      },
      description: {
        template: `[DESCRIPTION]:
Paragraph 1 (Story Hook): Start with a brief client story or personal experience related to {{VIDEO_TOPIC}}. Make it relatable and specific.
Paragraph 2 (The Lesson): Connect the story to {{SCRIPT_SUMMARY}}. What did this experience teach about the current market?
Paragraph 3 (Broader Application): How does this apply to viewers? Expand on {{SCRIPT_SUMMARY}} with practical context.
Paragraph 4 (Takeaway): 2-3 bullet points with actionable insights from the story.

[ABOUT + CONTACT + CTA sections remain the same as Variant 1]

#RealEstateStories #{{AGENT_CITY}} #[topic keywords]
TAGS: Focus on emotional keywords like "real estate advice", "home buying journey", "agent tips"`,
        maxLength: 450,
      },
      keyPoints: {
        template:
          'Focus on emotional keywords like "real estate advice", "home buying journey", "agent tips"',
        maxPoints: 10,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "What's your experience? Share in the comments below",
        examples: [
          "What's your experience? Share in the comments below",
          "Have you had a similar experience? Let me know",
        ],
      },
    },
    tone: "storytelling",
    platformOptimizations: {
      maxLength: 450,
      hashtagCount: 10,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your experience",
    },
    isActive: true,
  },
  {
    platform: "youtube",
    variant: 3,
    name: "Question-Led",
    description: "Answering pressing questions with data-driven insights",
    structure: {
      hook: {
        type: "question",
        template:
          'Frame as a question. Example: "Should You Wait to Buy? Here\'s What the Data Says" or "Is [Topic] Really Happening?"',
        examples: [
          "Should You Wait to Buy? Here's What the Data Says",
          "Is the Housing Market Really Cooling Down?",
        ],
      },
      description: {
        template: `[DESCRIPTION]:
Paragraph 1 (The Question): Pose the central question related to {{VIDEO_TOPIC}}. Create curiosity and urgency.
Paragraph 2 (The Data): Present facts, statistics, or trends from {{SCRIPT_SUMMARY}}. Be specific and credible.
Paragraph 3 (The Answer): Clearly answer the opening question with context. What does this mean for buyers/sellers?
Paragraph 4 (What To Do): Actionable guidance based on the answer.

[ABOUT + CONTACT + CTA - same structure]

KEY INSIGHT: [One-line summary of the answer]
#RealEstateAdvice #{{AGENT_CITY}}Market #[topic]
TAGS: Include question-based keywords like "should I buy a house", "when to sell", "real estate questions"`,
        maxLength: 400,
      },
      keyPoints: {
        template:
          'Include question-based keywords like "should I buy a house", "when to sell", "real estate questions"',
        maxPoints: 12,
      },
      conclusion: {
        ctaType: "question",
        template: "What questions do you have? Drop them in the comments",
        examples: [
          "What questions do you have? Drop them in the comments",
          "What's your take on this? Let me know below",
        ],
      },
    },
    tone: "analytical",
    platformOptimizations: {
      maxLength: 400,
      hashtagCount: 12,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Ask questions in comments",
    },
    isActive: true,
  },
  {
    platform: "youtube",
    variant: 4,
    name: "List-Based",
    description: "Scannable, numbered breakdowns with clear takeaways",
    structure: {
      hook: {
        type: "bold_statement",
        template:
          'Use numbers. Example: "5 Things About [Topic] Every Buyer Should Know" or "Top 3 [Topic] Mistakes to Avoid"',
        examples: [
          "5 Things About Market Timing Every Buyer Should Know",
          "Top 3 Home Buying Mistakes to Avoid",
        ],
      },
      description: {
        template: `[DESCRIPTION]:
Opening (Hook): Why this list matters. Connect to {{VIDEO_TOPIC}} urgency.
THE LIST:
1. [Point 1 from {{SCRIPT_SUMMARY}}]
   Brief explanation (2-3 sentences)
2. [Point 2]
   Brief explanation
3. [Point 3]
   Brief explanation
[Continue based on script content]

BOTTOM LINE:
One-sentence summary of the key takeaway.

[ABOUT + CONTACT + CTA - same]

TIMESTAMPS:
0:00 - Intro
0:20 - Point #1
1:00 - Point #2
[etc.]

#RealEstateTips #{{AGENT_CITY}} #[topic]
TAGS: "real estate tips", "home buying checklist", "seller advice", [topic-specific]`,
        maxLength: 350,
      },
      keyPoints: {
        template:
          '"real estate tips", "home buying checklist", "seller advice", [topic-specific]',
        maxPoints: 8,
      },
      conclusion: {
        ctaType: "action",
        template: "Save this video for your home buying journey",
        examples: [
          "Save this video for your home buying journey",
          "Share this with someone who needs it",
        ],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 350,
      hashtagCount: 8,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Save for reference",
    },
    isActive: true,
  },
  {
    platform: "youtube",
    variant: 5,
    name: "Contrarian/Hot Take",
    description:
      "Challenging conventional wisdom with evidence-based perspectives",
    structure: {
      hook: {
        type: "provocative",
        template:
          'Frame as contrarian. Example: "Why [Common Belief] is Wrong About [Topic]" or "The Truth About [Topic] No One Talks About"',
        examples: [
          "Why Waiting to Buy is Wrong About Market Timing",
          "The Truth About Real Estate Agents No One Talks About",
        ],
      },
      description: {
        template: `[DESCRIPTION]:
Paragraph 1 (The Myth): State the common belief related to {{VIDEO_TOPIC}}. "Everyone says..."
Paragraph 2 (The Reality): "But here's what's actually happening..." Use {{SCRIPT_SUMMARY}} to present the counter-narrative.
Paragraph 3 (The Evidence): Back it up with data, examples, or market trends. Be credible.
Paragraph 4 (What This Means): Reframe the viewer's understanding. What should they do differently?

REALITY CHECK: [One bold statement summary]

[ABOUT + CONTACT + CTA - same]

#RealEstateTruth #{{AGENT_CITY}}Market #[topic]
TAGS: "real estate myths", "housing market truth", "what agents won't tell you", [topic]`,
        maxLength: 400,
      },
      keyPoints: {
        template:
          '"real estate myths", "housing market truth", "what agents won\'t tell you", [topic]',
        maxPoints: 10,
      },
      conclusion: {
        ctaType: "provocative",
        template: "Agree or disagree? Let me know in the comments",
        examples: [
          "Agree or disagree? Let me know in the comments",
          "What do you think? Share your perspective",
        ],
      },
    },
    tone: "provocative",
    platformOptimizations: {
      maxLength: 400,
      hashtagCount: 10,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your opinion",
    },
    isActive: true,
  },

  // ===== INSTAGRAM TEMPLATES (5 variants) =====
  {
    platform: "instagram",
    variant: 1,
    name: "Hook-First Story",
    description:
      "Scroll-stopping content that leads with emotion and bold statements",
    structure: {
      hook: {
        type: "bold_statement",
        template:
          'Reframe {{SCRIPT_HOOK}} into a punchy, emoji-enhanced statement that stops the scroll.\nExample: "🔥 This just changed everything for buyers." or "📊 Here\'s what 90% of sellers don\'t know..."',
        examples: [
          "🔥 This just changed everything for buyers.",
          "📊 Here's what 90% of sellers don't know...",
        ],
      },
      description: {
        template: `[Blank line]

Lines 3-6 (STORY):
Share a brief story or scenario related to {{VIDEO_TOPIC}}. Make it relatable. Use "you" language.
Keep sentences short (10-15 words max).

[Blank line]

Lines 7-9 (TAKEAWAY):
What's the lesson from {{SCRIPT_SUMMARY}}? What should followers understand?
Use 2-3 bullet points with emojis as bullets.

[Blank line]

Line 10 (CTA):
Action-oriented. Examples:
- "Save this for later 📌"
- "Tag someone shopping for a home 🏠"
- "DM me 'rates' for a custom breakdown"

—
{{AGENT_NAME}} | {{AGENT_CITY}} Real Estate
Helping you win in this market 💪

HASHTAGS (5-8 in caption):
#{{AGENT_CITY}}RealEstate #RealEstateTips #HomeBuying #[topic-specific from {{VIDEO_TOPIC}}]`,
        maxLength: 300,
      },
      keyPoints: {
        template:
          "FIRST COMMENT (20-25 additional hashtags):\nMix of location, broad, niche, and topic-specific:\n#{{AGENT_CITY}}Homes #{{AGENT_CITY}}Realtor #RealEstateAgent #HousingMarket #FirstTimeHomeBuyer #RealEstateLife #HomeSellers #RealEstateInvesting #[15-20 more relevant tags]",
        maxPoints: 25,
      },
      conclusion: {
        ctaType: "action",
        template: "Save this for later 📌",
        examples: [
          "Save this for later 📌",
          "Tag someone shopping for a home 🏠",
        ],
      },
    },
    tone: "energetic",
    platformOptimizations: {
      maxLength: 300,
      hashtagCount: 8,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Save for later",
    },
    isActive: true,
  },
  {
    platform: "instagram",
    variant: 2,
    name: "Question-Led Engagement",
    description: "Engagement-focused content that drives discussion",
    structure: {
      hook: {
        type: "question",
        template:
          'Turn {{VIDEO_TOPIC}} into a direct question. Example: "Should you wait to buy? 🤔"',
        examples: [
          "Should you wait to buy? 🤔",
          "Is now the right time to sell? 💭",
        ],
      },
      description: {
        template: `[Blank line]

Lines 2-5 (SHORT ANSWER):
Quick breakdown of {{SCRIPT_SUMMARY}} in 3-4 sentences.
Use contractions. Be conversational.
One emoji per sentence max.

[Blank line]

Lines 6-7 (CONTEXT):
Why this matters right now. Create urgency or relevance.

[Blank line]

Line 8 (CTA - discussion-focused):
"What would you do? Drop your thoughts below 💬" or "Questions? I'm answering all of them today 📱"

—
{{AGENT_NAME}} | {{AGENT_CITY}} Real Estate
Your local market expert 🏠

HASHTAGS (6-8): #{{AGENT_CITY}}RealEstate #RealEstateAdvice #[topic-specific]`,
        maxLength: 250,
      },
      keyPoints: {
        template: "FIRST COMMENT: [20-25 hashtags as in Variant 1]",
        maxPoints: 25,
      },
      conclusion: {
        ctaType: "question",
        template: "What would you do? Drop your thoughts below 💬",
        examples: [
          "What would you do? Drop your thoughts below 💬",
          "Questions? I'm answering all of them today 📱",
        ],
      },
    },
    tone: "casual",
    platformOptimizations: {
      maxLength: 250,
      hashtagCount: 8,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Share your thoughts",
    },
    isActive: true,
  },
  {
    platform: "instagram",
    variant: 3,
    name: "Value-First Listicle",
    description: "Scannable, value-packed content with numbered breakdowns",
    structure: {
      hook: {
        type: "bold_statement",
        template:
          '"3 things about [{{VIDEO_TOPIC}}] you need to know 💡" or "The [topic] breakdown, made simple:"',
        examples: [
          "3 things about market timing you need to know 💡",
          "The home buying breakdown, made simple:",
        ],
      },
      description: {
        template: `[Blank line]

Lines 2-8 (NUMBERED LIST):
Break down {{SCRIPT_SUMMARY}} into 3-4 digestible points:
1️⃣ [Point one - 1-2 sentences]
2️⃣ [Point two - 1-2 sentences]
3️⃣ [Point three - 1-2 sentences]

[Blank line]

Line 9 (BOTTOM LINE):
One sentence summary. "Bottom line: [key takeaway]"

[Blank line]

Line 10 (CTA):
Save or share focused. "Save this so you don't forget 📌" or "Send this to someone house hunting 🏠"

—
{{AGENT_NAME}} | {{AGENT_CITY}} Real Estate

HASHTAGS (5-7): #RealEstateTips #{{AGENT_CITY}} #[topic]`,
        maxLength: 200,
      },
      keyPoints: {
        template: "FIRST COMMENT: [hashtag block]",
        maxPoints: 20,
      },
      conclusion: {
        ctaType: "action",
        template: "Save this so you don't forget 📌",
        examples: [
          "Save this so you don't forget 📌",
          "Send this to someone house hunting 🏠",
        ],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 200,
      hashtagCount: 7,
      emojiUsage: "heavy",
      lineBreaks: true,
      callToAction: "Save for reference",
    },
    isActive: true,
  },
  {
    platform: "instagram",
    variant: 4,
    name: "Behind-the-Scenes",
    description:
      "Authentic, insider-perspective content showing real market insights",
    structure: {
      hook: {
        type: "story",
        template:
          '"Here\'s what I\'m seeing in {{AGENT_CITY}} right now..." or "Real talk from the field 💯"',
        examples: [
          "Here's what I'm seeing in Austin right now...",
          "Real talk from the field 💯",
        ],
      },
      description: {
        template: `[Blank line]

Lines 3-7 (OBSERVATIONS):
Share 2-3 specific things you're noticing related to {{VIDEO_TOPIC}}.
Use "I'm seeing...", "My clients are...", "The market is..."
Personal, first-person perspective.

[Blank line]

Lines 8-9 (WHAT IT MEANS):
Connect observations to {{SCRIPT_SUMMARY}}. What should followers take away?

[Blank line]

Line 10 (CTA - collaborative):
"What are you seeing? Any questions? 💬" or "Let's talk strategy - DM me 📱"

—
{{AGENT_NAME}} | Real Estate in {{AGENT_CITY}}

HASHTAGS: #{{AGENT_CITY}}Market #RealEstateInsights #[topic]`,
        maxLength: 280,
      },
      keyPoints: {
        template: "FIRST COMMENT: [hashtag block]",
        maxPoints: 20,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "What are you seeing? Any questions? 💬",
        examples: [
          "What are you seeing? Any questions? 💬",
          "Let's talk strategy - DM me 📱",
        ],
      },
    },
    tone: "relatable",
    platformOptimizations: {
      maxLength: 280,
      hashtagCount: 6,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Share your observations",
    },
    isActive: true,
  },
  {
    platform: "instagram",
    variant: 5,
    name: "Myth-Busting",
    description:
      "Corrective, educational content that challenges misconceptions",
    structure: {
      hook: {
        type: "provocative",
        template:
          '"Everyone thinks [common belief about {{VIDEO_TOPIC}}]..." or "Myth: [false belief] ❌"',
        examples: [
          "Everyone thinks you need 20% down...",
          "Myth: You need perfect credit to buy ❌",
        ],
      },
      description: {
        template: `[Blank line]

Line 2 (THE REALITY):
"But here's what's really happening ✅" or "Reality check: "

[Blank line]

Lines 3-6 (THE TRUTH):
Break down {{SCRIPT_SUMMARY}} to correct the misconception.
Be clear and direct.
Use data or examples if applicable.

[Blank line]

Lines 7-8 (WHY IT MATTERS):
Why does this myth hurt buyers/sellers? What should they do instead?

[Blank line]

Line 9 (CTA):
"Share this with someone who needs to hear it 📢" or "What other myths should I bust? 🤔"

—
{{AGENT_NAME}} | {{AGENT_CITY}} Real Estate
Keeping it real since [year] 💯

HASHTAGS: #RealEstateMyths #{{AGENT_CITY}} #[topic]`,
        maxLength: 250,
      },
      keyPoints: {
        template: "FIRST COMMENT: [hashtag block]",
        maxPoints: 20,
      },
      conclusion: {
        ctaType: "share",
        template: "Share this with someone who needs to hear it 📢",
        examples: [
          "Share this with someone who needs to hear it 📢",
          "What other myths should I bust? 🤔",
        ],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 250,
      hashtagCount: 6,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Share the truth",
    },
    isActive: true,
  },

  // ===== TIKTOK TEMPLATES (5 variants) =====
  {
    platform: "tiktok",
    variant: 1,
    name: "Question Hook",
    description: "Ultra-short, scroll-stopping content with direct questions",
    structure: {
      hook: {
        type: "question",
        template:
          '[Turn {{VIDEO_TOPIC}} into a direct question]\nExample formats:\n- "Why did [topic]? 🤔"\n- "Should you [action related to topic]? Here\'s the truth."\n- "Is [topic] really happening? Let me explain."\nAdd 1-2 relevant emojis.',
        examples: [
          "Why did mortgage rates drop? 🤔",
          "Should you wait to buy? Here's the truth.",
        ],
      },
      description: {
        template: `HASHTAGS (3-5 in caption):
#RealEstate #{{AGENT_CITY}} #[topic keyword] #RealEstateTips #fyp

NO LONG DESCRIPTIONS. TikTok users don't read - they watch and scroll.`,
        maxLength: 150,
      },
      keyPoints: {
        template:
          "#RealEstate #{{AGENT_CITY}} #[topic keyword] #RealEstateTips #fyp",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "question",
        template: "Follow for more tips 🔥",
        examples: ["Follow for more tips 🔥", "What do you think? 💭"],
      },
    },
    tone: "ultra_casual",
    platformOptimizations: {
      maxLength: 150,
      hashtagCount: 5,
      emojiUsage: "heavy",
      lineBreaks: false,
      callToAction: "Follow for more",
    },
    isActive: true,
  },
  {
    platform: "tiktok",
    variant: 2,
    name: "Bold Statement",
    description:
      "Attention-grabbing content with controversial or surprising claims",
    structure: {
      hook: {
        type: "bold_statement",
        template:
          '[Make a bold claim from {{SCRIPT_SUMMARY}}]\nExample formats:\n- "[Bold statement about {{VIDEO_TOPIC}}] and here\'s why 💯"\n- "Everyone\'s doing [X] wrong. Let me explain."\n- "This changed everything for buyers. 🔥"\n1-2 emojis max.',
        examples: [
          "Waiting to buy is costing you money and here's why 💯",
          "Everyone's doing home tours wrong. Let me explain.",
        ],
      },
      description: {
        template: `HASHTAGS (3-5):
#RealEstate #{{AGENT_CITY}} #RealEstateTok #[topic] #fyp`,
        maxLength: 150,
      },
      keyPoints: {
        template: "#RealEstate #{{AGENT_CITY}} #RealEstateTok #[topic] #fyp",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "action",
        template: "Save this for later 📌",
        examples: ["Save this for later 📌", "Share if this helped 🔄"],
      },
    },
    tone: "edgy",
    platformOptimizations: {
      maxLength: 150,
      hashtagCount: 5,
      emojiUsage: "heavy",
      lineBreaks: false,
      callToAction: "Save for later",
    },
    isActive: true,
  },
  {
    platform: "tiktok",
    variant: 3,
    name: "Here's What...",
    description: "Clear, educational content explaining complex topics simply",
    structure: {
      hook: {
        type: "bold_statement",
        template:
          '"Here\'s what [{{VIDEO_TOPIC}}] means for you" or "What you need to know about [topic] 💡"\nKeep it straightforward and informative.',
        examples: [
          "Here's what mortgage rates mean for you",
          "What you need to know about market timing 💡",
        ],
      },
      description: {
        template: `HASHTAGS (3-5):
#RealEstate #{{AGENT_CITY}}RealEstate #HomeBuying #[topic] #fyp`,
        maxLength: 150,
      },
      keyPoints: {
        template:
          "#RealEstate #{{AGENT_CITY}}RealEstate #HomeBuying #[topic] #fyp",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "action",
        template: "Follow for more tips 📱",
        examples: ["Follow for more tips 📱", "DM me questions 💬"],
      },
    },
    tone: "entertaining",
    platformOptimizations: {
      maxLength: 150,
      hashtagCount: 5,
      emojiUsage: "heavy",
      lineBreaks: false,
      callToAction: "Follow for more",
    },
    isActive: true,
  },
  {
    platform: "tiktok",
    variant: 4,
    name: "POV/Scenario",
    description: "Relatable content using POV format for engagement",
    structure: {
      hook: {
        type: "story",
        template:
          '"POV: [scenario related to {{VIDEO_TOPIC}}]"\nExamples:\n- "POV: You just found out [topic detail]"\n- "POV: You\'re a first-time buyer and [situation from topic]"\n1 emoji.',
        examples: [
          "POV: You just found out mortgage rates dropped",
          "POV: You're a first-time buyer and the market is crazy",
        ],
      },
      description: {
        template: `HASHTAGS (3-5):
#RealEstatePOV #{{AGENT_CITY}} #[topic] #RealEstate #fyp`,
        maxLength: 150,
      },
      keyPoints: {
        template: "#RealEstatePOV #{{AGENT_CITY}} #[topic] #RealEstate #fyp",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "question",
        template: "Relate? Drop a comment 👇",
        examples: ["Relate? Drop a comment 👇", "Been there? Let me know 💭"],
      },
    },
    tone: "authentic",
    platformOptimizations: {
      maxLength: 150,
      hashtagCount: 5,
      emojiUsage: "heavy",
      lineBreaks: false,
      callToAction: "Share your experience",
    },
    isActive: true,
  },
  {
    platform: "tiktok",
    variant: 5,
    name: "Numbers/Stats",
    description: "Data-driven content leading with surprising statistics",
    structure: {
      hook: {
        type: "data",
        template:
          '[Lead with surprising stat from {{VIDEO_TOPIC}}]\nExample:\n- "[Number]% of buyers don\'t know this 💯"\n- "This number just changed for [topic] 📊"',
        examples: [
          "90% of buyers don't know this 💯",
          "This number just changed for mortgage rates 📊",
        ],
      },
      description: {
        template: `HASHTAGS (3-5):
#RealEstateData #{{AGENT_CITY}}Market #RealEstate #[topic] #fyp`,
        maxLength: 150,
      },
      keyPoints: {
        template:
          "#RealEstateData #{{AGENT_CITY}}Market #RealEstate #[topic] #fyp",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "action",
        template: "Follow for more data 📈",
        examples: ["Follow for more data 📈", "Save this stat 📌"],
      },
    },
    tone: "authentic",
    platformOptimizations: {
      maxLength: 150,
      hashtagCount: 5,
      emojiUsage: "heavy",
      lineBreaks: false,
      callToAction: "Follow for data",
    },
    isActive: true,
  },

  // ===== FACEBOOK TEMPLATES (5 variants) =====
  {
    platform: "facebook",
    variant: 1,
    name: "Community Update",
    description: "Friendly, community-focused content for local market updates",
    structure: {
      hook: {
        type: "story",
        template:
          '"Hey {{AGENT_CITY}} friends," or "Quick update for local buyers and sellers:"\nFriendly, approachable tone.',
        examples: [
          "Hey Austin friends,",
          "Quick update for local buyers and sellers:",
        ],
      },
      description: {
        template: `Body (2-3 sentences):
Break down {{SCRIPT_SUMMARY}} in plain language. Avoid jargon.
Focus on "what this means for you."

CTA (community-focused):
"What questions do you have? Drop them below 💬" or "Tag someone who needs to see this!"

Emoji use: 2-3 total (not excessive).

HASHTAGS (optional, 2-3 max):
#{{AGENT_CITY}}RealEstate #RealEstate

NOTE: Facebook prioritizes native video. Keep text conversational, not salesy.`,
        maxLength: 100,
      },
      keyPoints: {
        template: "#{{AGENT_CITY}}RealEstate #RealEstate",
        maxPoints: 3,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "What questions do you have? Drop them below 💬",
        examples: [
          "What questions do you have? Drop them below 💬",
          "Tag someone who needs to see this!",
        ],
      },
    },
    tone: "friendly",
    platformOptimizations: {
      maxLength: 100,
      hashtagCount: 3,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Ask questions",
    },
    isActive: true,
  },
  {
    platform: "facebook",
    variant: 2,
    name: "Question-to-Community",
    description: "Discussion-driving content that asks audience directly",
    structure: {
      hook: {
        type: "question",
        template:
          'Ask directly about {{VIDEO_TOPIC}}. Example: "Are you waiting to buy, or jumping in now?"',
        examples: [
          "Are you waiting to buy, or jumping in now?",
          "What's your take on the current market?",
        ],
      },
      description: {
        template: `Lines 2-4 (BRIEF CONTEXT):
1-2 sentences on {{SCRIPT_SUMMARY}} to frame the question.

Line 5 (CTA):
"I'd love to hear your thoughts - what's your take? 💭"

Conversational, opinion-seeking tone.

HASHTAGS: Optional, 1-2 max`,
        maxLength: 80,
      },
      keyPoints: {
        template: "Optional, 1-2 max",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "question",
        template: "I'd love to hear your thoughts - what's your take? 💭",
        examples: [
          "I'd love to hear your thoughts - what's your take? 💭",
          "What's your experience been? Share below 👇",
        ],
      },
    },
    tone: "community_focused",
    platformOptimizations: {
      maxLength: 80,
      hashtagCount: 2,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your thoughts",
    },
    isActive: true,
  },
  {
    platform: "facebook",
    variant: 3,
    name: "Just Learned...",
    description: "Authentic, learning-focused content sharing new information",
    structure: {
      hook: {
        type: "story",
        template:
          '"I just learned something about [{{VIDEO_TOPIC}}] that I had to share..."',
        examples: [
          "I just learned something about mortgage rates that I had to share...",
          "I just discovered something about market timing that I had to share...",
        ],
      },
      description: {
        template: `Body: Explain {{SCRIPT_SUMMARY}} as if sharing news with friends. Enthusiastic but not overhyped.

Closing: "Thought you'd want to know! Share this if it's helpful 📢"

Friendly, genuine tone.

HASHTAGS: 1-2 max`,
        maxLength: 90,
      },
      keyPoints: {
        template: "1-2 max",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "share",
        template: "Thought you'd want to know! Share this if it's helpful 📢",
        examples: [
          "Thought you'd want to know! Share this if it's helpful 📢",
          "Hope this helps someone! Share if useful 🙏",
        ],
      },
    },
    tone: "helpful",
    platformOptimizations: {
      maxLength: 90,
      hashtagCount: 2,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share if helpful",
    },
    isActive: true,
  },
  {
    platform: "facebook",
    variant: 4,
    name: "Here's the Deal",
    description: "Clear, no-nonsense content explaining complex topics",
    structure: {
      hook: {
        type: "bold_statement",
        template:
          '"Here\'s the deal with [{{VIDEO_TOPIC}}]:" or "Let me break down [topic] for you:"',
        examples: [
          "Here's the deal with mortgage rates:",
          "Let me break down market timing for you:",
        ],
      },
      description: {
        template: `Body: Straight-talk explanation of {{SCRIPT_SUMMARY}}. No fluff. Clear and direct.

Bottom Line: "What you need to know: [one-sentence takeaway]"

CTA: "Questions? Drop them below or DM me directly 💬"

Professional but accessible tone.

HASHTAGS: Optional, 1-2`,
        maxLength: 100,
      },
      keyPoints: {
        template: "Optional, 1-2",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "action",
        template: "Questions? Drop them below or DM me directly 💬",
        examples: [
          "Questions? Drop them below or DM me directly 💬",
          "Need clarification? Let me know 👇",
        ],
      },
    },
    tone: "conversational",
    platformOptimizations: {
      maxLength: 100,
      hashtagCount: 2,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Ask questions",
    },
    isActive: true,
  },
  {
    platform: "facebook",
    variant: 5,
    name: "Local Story",
    description:
      "Locally-relevant content connecting global trends to local impact",
    structure: {
      hook: {
        type: "story",
        template:
          '"Something\'s happening in {{AGENT_CITY}} that affects [buyers/sellers]..."',
        examples: [
          "Something's happening in Austin that affects buyers...",
          "Something's happening in Austin that affects sellers...",
        ],
      },
      description: {
        template: `Body: Connect {{VIDEO_TOPIC}} to local context. Make {{SCRIPT_SUMMARY}} feel specific to this community.

Closing: "If you're in the area, this matters. Let me know if you have questions! 💬"

Community-focused, helpful tone.

HASHTAGS: #{{AGENT_CITY}} #{{AGENT_CITY}}RealEstate`,
        maxLength: 100,
      },
      keyPoints: {
        template: "#{{AGENT_CITY}} #{{AGENT_CITY}}RealEstate",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "collaborative",
        template:
          "If you're in the area, this matters. Let me know if you have questions! 💬",
        examples: [
          "If you're in the area, this matters. Let me know if you have questions! 💬",
          "Local friends, this affects you. Questions? Ask away 👇",
        ],
      },
    },
    tone: "conversational",
    platformOptimizations: {
      maxLength: 100,
      hashtagCount: 2,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Ask local questions",
    },
    isActive: true,
  },

  // ===== LINKEDIN TEMPLATES (5 variants) =====
  {
    platform: "linkedin",
    variant: 1,
    name: "Industry Insight",
    description: "Professional, analytical content with industry context",
    structure: {
      hook: {
        type: "data",
        template:
          'Professional observation about {{VIDEO_TOPIC}}. Example: "The real estate landscape just shifted, and here\'s what it means for my clients."',
        examples: [
          "The real estate landscape just shifted, and here's what it means for my clients.",
          "Market data reveals a significant trend that's reshaping how we approach real estate.",
        ],
      },
      description: {
        template: `Body (3-4 paragraphs with line breaks):

Paragraph 1 - What's Happening:
Explain {{SCRIPT_SUMMARY}} with industry context. Use data if available.

Paragraph 2 - Why It Matters:
Industry implications. Broader market context.

Paragraph 3 - What To Do:
Actionable takeaway for professionals or clients.
(Each paragraph: 2-3 sentences, line break between)

Personal Context (1 sentence):
"In the {{AGENT_CITY}} market specifically, I'm seeing [relevant local angle]."

CTA (professional, consultative):
"If you're navigating this market, let's connect - I'd be happy to share insights specific to your situation."

Sign-off:
—
{{AGENT_NAME}}
Real Estate Professional | {{AGENT_CITY}}
Helping clients make informed decisions in an evolving market

HASHTAGS (3-5, professional):
#RealEstate #{{AGENT_CITY}} #RealEstateInsights #HousingMarket #[topic from {{VIDEO_TOPIC}}]

TONE: Professional, analytical, third-person observations with first-person perspective
NO EMOJIS`,
        maxLength: 250,
      },
      keyPoints: {
        template:
          "#RealEstate #{{AGENT_CITY}} #RealEstateInsights #HousingMarket #[topic from {{VIDEO_TOPIC}}]",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "collaborative",
        template:
          "If you're navigating this market, let's connect - I'd be happy to share insights specific to your situation.",
        examples: [
          "If you're navigating this market, let's connect - I'd be happy to share insights specific to your situation.",
          "I'd be happy to discuss how this impacts your specific situation.",
        ],
      },
    },
    tone: "analytical",
    platformOptimizations: {
      maxLength: 250,
      hashtagCount: 5,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Connect for insights",
    },
    isActive: true,
  },
  {
    platform: "linkedin",
    variant: 2,
    name: "Personal Story/Lesson",
    description:
      "Relatable, narrative-driven content with professional lessons",
    structure: {
      hook: {
        type: "story",
        template:
          '"A conversation with a client this week reminded me of something important about {{VIDEO_TOPIC}}..."',
        examples: [
          "A conversation with a client this week reminded me of something important about market timing...",
          "A recent client experience taught me something valuable about mortgage rates...",
        ],
      },
      description: {
        template: `Story (2-3 paragraphs):
Brief client anecdote (anonymized) or personal market experience.
Connect to {{SCRIPT_SUMMARY}}.
Make it specific but relatable.

Lesson (1 paragraph):
"What this taught me: [key insight from {{SCRIPT_SUMMARY}}]"

Broader Application (1 paragraph):
How this lesson applies to the current market or industry at large.

CTA (consultative):
"What are you seeing in your market? I'd love to hear your perspective."

Sign-off:
—
{{AGENT_NAME}}
Real Estate Professional | {{AGENT_CITY}}

HASHTAGS (3-5): #RealEstate #{{AGENT_CITY}} #RealEstateLife #[topic]

TONE: Relatable, first-person narrative, professional but personable
NO EMOJIS`,
        maxLength: 250,
      },
      keyPoints: {
        template: "#RealEstate #{{AGENT_CITY}} #RealEstateLife #[topic]",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "question",
        template:
          "What are you seeing in your market? I'd love to hear your perspective.",
        examples: [
          "What are you seeing in your market? I'd love to hear your perspective.",
          "I'd love to hear about your experiences with this trend.",
        ],
      },
    },
    tone: "consultative",
    platformOptimizations: {
      maxLength: 250,
      hashtagCount: 5,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your perspective",
    },
    isActive: true,
  },
  {
    platform: "linkedin",
    variant: 3,
    name: "Question-Led Analysis",
    description: "Analytical, question-based content with data-driven answers",
    structure: {
      hook: {
        type: "question",
        template:
          'Provocative question about {{VIDEO_TOPIC}}. Example: "Are buyers waiting too long? Here\'s what the data shows..."',
        examples: [
          "Are buyers waiting too long? Here's what the data shows...",
          "Is the market really cooling down? Let's examine the numbers...",
        ],
      },
      description: {
        template: `Analysis (3 paragraphs):

Paragraph 1 - The Data:
Present facts/trends from {{SCRIPT_SUMMARY}}. Be specific and credible.

Paragraph 2 - The Answer:
Directly answer the opening question with context.

Paragraph 3 - What It Means:
Implications for buyers, sellers, or the industry.

Takeaway (1 sentence):
"The key insight: [one-line summary]"

CTA (thought leadership):
"Thoughts? What are you advising your clients in this environment?"

Sign-off:
—
{{AGENT_NAME}}
{{AGENT_CITY}} Real Estate

HASHTAGS (3-5): #RealEstateAnalysis #{{AGENT_CITY}}Market #HousingTrends #[topic]

TONE: Analytical, data-driven, consultative
NO EMOJIS`,
        maxLength: 250,
      },
      keyPoints: {
        template:
          "#RealEstateAnalysis #{{AGENT_CITY}}Market #HousingTrends #[topic]",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "question",
        template:
          "Thoughts? What are you advising your clients in this environment?",
        examples: [
          "Thoughts? What are you advising your clients in this environment?",
          "What's your take on this data? I'd love to hear your analysis.",
        ],
      },
    },
    tone: "analytical",
    platformOptimizations: {
      maxLength: 250,
      hashtagCount: 5,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your analysis",
    },
    isActive: true,
  },
  {
    platform: "linkedin",
    variant: 4,
    name: "List/Framework",
    description: "Structured, scannable content with numbered observations",
    structure: {
      hook: {
        type: "bold_statement",
        template:
          '"3 shifts happening in the {{AGENT_CITY}} market right now:"',
        examples: [
          "3 shifts happening in the Austin market right now:",
          "5 trends I'm watching in real estate this quarter:",
        ],
      },
      description: {
        template: `Numbered List:
1. [Observation 1 from {{SCRIPT_SUMMARY}}]
Brief explanation (2-3 sentences)

2. [Observation 2]
Brief explanation

3. [Observation 3]
Brief explanation

Summary (1 paragraph):
What these shifts mean collectively. Connect to {{VIDEO_TOPIC}}.

Professional Context:
"As a real estate professional in {{AGENT_CITY}}, I'm watching these trends closely to serve my clients better."

CTA (collaborative):
"What are you noticing in your market? Let's compare notes."

Sign-off:
—
{{AGENT_NAME}}
Real Estate Professional | {{AGENT_CITY}}

HASHTAGS (3-5): #RealEstate #MarketTrends #{{AGENT_CITY}} #[topic]

TONE: Structured, observational, professional
NO EMOJIS`,
        maxLength: 250,
      },
      keyPoints: {
        template: "#RealEstate #MarketTrends #{{AGENT_CITY}} #[topic]",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "What are you noticing in your market? Let's compare notes.",
        examples: [
          "What are you noticing in your market? Let's compare notes.",
          "I'd love to hear what trends you're seeing in your area.",
        ],
      },
    },
    tone: "professional",
    platformOptimizations: {
      maxLength: 250,
      hashtagCount: 5,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Compare market notes",
    },
    isActive: true,
  },
  {
    platform: "linkedin",
    variant: 5,
    name: "Contrarian/Unpopular Opinion",
    description:
      "Thought-provoking content that challenges conventional wisdom",
    structure: {
      hook: {
        type: "provocative",
        template:
          '"Unpopular opinion: [contrarian take on {{VIDEO_TOPIC}}]" or "Everyone says [X], but here\'s what\'s really happening..."',
        examples: [
          "Unpopular opinion: Waiting to buy is actually costing you money",
          "Everyone says the market is cooling, but here's what's really happening...",
        ],
      },
      description: {
        template: `Counter-Narrative (2-3 paragraphs):

Paragraph 1 - The Common Belief:
What most people think about {{VIDEO_TOPIC}}.

Paragraph 2 - The Reality:
Present counter-evidence from {{SCRIPT_SUMMARY}}. Be bold but credible.

Paragraph 3 - Why It Matters:
What this means for the industry or clients.

Perspective (1 sentence):
"In my experience with {{AGENT_CITY}} clients, this contrarian view has proven accurate."

CTA (discussion-focused):
"Agree? Disagree? I'm interested in other perspectives - let me know what you think."

Sign-off:
—
{{AGENT_NAME}}
Real Estate Professional | {{AGENT_CITY}}
Challenging conventional wisdom in real estate

HASHTAGS (3-5): #RealEstate #UnpopularOpinion #{{AGENT_CITY}} #[topic]

TONE: Bold, opinion-driven, professional credibility
NO EMOJIS`,
        maxLength: 250,
      },
      keyPoints: {
        template: "#RealEstate #UnpopularOpinion #{{AGENT_CITY}} #[topic]",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "question",
        template:
          "Agree? Disagree? I'm interested in other perspectives - let me know what you think.",
        examples: [
          "Agree? Disagree? I'm interested in other perspectives - let me know what you think.",
          "What's your take? I'd love to hear different viewpoints on this.",
        ],
      },
    },
    tone: "provocative",
    platformOptimizations: {
      maxLength: 250,
      hashtagCount: 5,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your perspective",
    },
    isActive: true,
  },

  // ===== TWITTER TEMPLATES (5 variants) =====
  {
    platform: "twitter",
    variant: 1,
    name: "News Hook",
    description: "Breaking news and market updates with data-driven insights",
    structure: {
      hook: {
        type: "data",
        template: "BREAKING: [{{VIDEO_TOPIC}}] - Here's what the data shows",
        examples: [
          "BREAKING: Austin luxury condo market - Here's what the data shows",
          "BREAKING: Mortgage rates drop - Here's what the data shows",
        ],
      },
      description: {
        template:
          "Thread 🧵\n\n1/ {{SCRIPT_SUMMARY}}\n\n2/ Key insights: [Data points and trends]\n\n3/ What this means for buyers/sellers: [Practical implications]",
        maxLength: 280,
      },
      keyPoints: {
        template: "#RealEstate #{{AGENT_CITY}} #[topic] #MarketUpdate #Data",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "action",
        template: "Follow for more market insights 📊",
        examples: [
          "Follow for more market insights 📊",
          "Retweet if this helped you 🔄",
        ],
      },
    },
    tone: "analytical",
    platformOptimizations: {
      maxLength: 280,
      hashtagCount: 5,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Follow for insights",
    },
    isActive: true,
  },
  {
    platform: "twitter",
    variant: 2,
    name: "Question Thread",
    description: "Engagement-focused content with direct questions",
    structure: {
      hook: {
        type: "question",
        template: "Quick question: [{{VIDEO_TOPIC}}] - What's your take?",
        examples: [
          "Quick question: Austin luxury condos - What's your take?",
          "Quick question: Market timing - What's your take?",
        ],
      },
      description: {
        template:
          "Thread 🧵\n\n1/ {{SCRIPT_SUMMARY}}\n\n2/ My perspective: [Professional insight]\n\n3/ But I want to hear from you: [Community question]",
        maxLength: 280,
      },
      keyPoints: {
        template:
          "#RealEstate #{{AGENT_CITY}} #[topic] #RealEstateTalk #Community",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "question",
        template: "What do you think? Drop your thoughts below 👇",
        examples: [
          "What do you think? Drop your thoughts below 👇",
          "Your turn - what's your experience? 💭",
        ],
      },
    },
    tone: "conversational",
    platformOptimizations: {
      maxLength: 280,
      hashtagCount: 5,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Share your thoughts",
    },
    isActive: true,
  },
  {
    platform: "twitter",
    variant: 3,
    name: "Tip Thread",
    description: "Educational content with actionable tips",
    structure: {
      hook: {
        type: "bold_statement",
        template: "Pro tip: [{{VIDEO_TOPIC}}] - Most people get this wrong",
        examples: [
          "Pro tip: Austin luxury condos - Most people get this wrong",
          "Pro tip: Home buying process - Most people get this wrong",
        ],
      },
      description: {
        template:
          "Thread 🧵\n\n1/ {{SCRIPT_SUMMARY}}\n\n2/ The mistake: [Common error]\n\n3/ The solution: [Correct approach]\n\n4/ Why this matters: [Impact]",
        maxLength: 280,
      },
      keyPoints: {
        template:
          "#RealEstateTips #{{AGENT_CITY}} #[topic] #HomeBuying #ProTips",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "action",
        template: "Save this thread for later 📌",
        examples: [
          "Save this thread for later 📌",
          "Bookmark this for your home buying journey 🔖",
        ],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 280,
      hashtagCount: 5,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Save for reference",
    },
    isActive: true,
  },
  {
    platform: "twitter",
    variant: 4,
    name: "Story Thread",
    description: "Personal anecdotes and client stories",
    structure: {
      hook: {
        type: "story",
        template:
          "Story time: [{{VIDEO_TOPIC}}] - This client taught me something",
        examples: [
          "Story time: Austin luxury condos - This client taught me something",
          "Story time: Market timing - This client taught me something",
        ],
      },
      description: {
        template:
          "Thread 🧵\n\n1/ {{SCRIPT_SUMMARY}}\n\n2/ The story: [Client anecdote]\n\n3/ The lesson: [Key takeaway]\n\n4/ How this applies to you: [Practical application]",
        maxLength: 280,
      },
      keyPoints: {
        template:
          "#RealEstateStories #{{AGENT_CITY}} #[topic] #ClientStories #Lessons",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "Have a similar story? Share it below 👇",
        examples: [
          "Have a similar story? Share it below 👇",
          "Been there? Let me know your experience 💭",
        ],
      },
    },
    tone: "storytelling",
    platformOptimizations: {
      maxLength: 280,
      hashtagCount: 5,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Share your story",
    },
    isActive: true,
  },
  {
    platform: "twitter",
    variant: 5,
    name: "Hot Take Thread",
    description: "Contrarian perspectives and bold opinions",
    structure: {
      hook: {
        type: "provocative",
        template: "Hot take: [{{VIDEO_TOPIC}}] - Everyone's doing it wrong",
        examples: [
          "Hot take: Austin luxury condos - Everyone's doing it wrong",
          "Hot take: Market timing - Everyone's doing it wrong",
        ],
      },
      description: {
        template:
          "Thread 🧵\n\n1/ {{SCRIPT_SUMMARY}}\n\n2/ The popular opinion: [Common belief]\n\n3/ Why it's wrong: [Counter-argument]\n\n4/ The truth: [Alternative perspective]",
        maxLength: 280,
      },
      keyPoints: {
        template:
          "#RealEstateHotTake #{{AGENT_CITY}} #[topic] #UnpopularOpinion #Truth",
        maxPoints: 5,
      },
      conclusion: {
        ctaType: "provocative",
        template: "Agree? Disagree? Let's debate 👇",
        examples: [
          "Agree? Disagree? Let's debate 👇",
          "What's your take? I want to hear different views 💭",
        ],
      },
    },
    tone: "provocative",
    platformOptimizations: {
      maxLength: 280,
      hashtagCount: 5,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your opinion",
    },
    isActive: true,
  },
];

async function initializeEnhancedTemplates(): Promise<void> {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/edge-ai";

    await mongoose.connect(mongoUri);

    // Clear existing templates
    await ContentTemplate.deleteMany({});

    // Add enhanced templates one by one
    let addedCount = 0;
    for (const template of enhancedTemplates) {
      try {
        const newTemplate = new ContentTemplate(template);
        await newTemplate.save();
        addedCount++;
      } catch (error) {}
    }

    const platformCounts: any = enhancedTemplates.reduce(
      (acc: any, template) => {
        acc[template.platform] = (acc[template.platform] || 0) + 1;
        return acc;
      },
      {}
    );

    Object.entries(platformCounts).forEach(([platform, count]) => {
      console.log(`  ${platform}: ${count} templates`);
    });
  } catch (error) {
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Run the script
if (require.main === module) {
  initializeEnhancedTemplates()
    .then(() => {
      console.log("✅ Enhanced template initialization completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Enhanced initialization failed:", error);
      process.exit(1);
    });
}

export default initializeEnhancedTemplates;
