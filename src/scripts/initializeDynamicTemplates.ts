import mongoose from "mongoose";
import ContentTemplate from "../models/ContentTemplate";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// 25 Templates: 5 variants × 5 platforms (Instagram, Facebook, LinkedIn, TikTok, YouTube)
const templates = [
  // ===== INSTAGRAM TEMPLATES (5 variants) =====
  {
    platform: "instagram",
    variant: 1,
    name: "Visual Storytelling",
    description: "Engaging visual-first content with strong hashtag strategy",
    structure: {
      hook: {
        type: "bold_statement",
        template: "This just changed everything for [topic]! 🔥",
        examples: ["This just changed everything for Austin real estate! 🔥"],
      },
      description: {
        template:
          "Here's what I'm seeing in [city]: [key_points]. This means [implication] for [target_audience].",
        maxLength: 200,
      },
      keyPoints: {
        template: "The key insight: [insight]. What this means: [implication].",
        maxPoints: 3,
      },
      conclusion: {
        ctaType: "action",
        template: "Save this for later 📌 Tag someone who needs to see this 👥",
        examples: [
          "Save this for later 📌",
          "Tag someone who needs to see this 👥",
        ],
      },
    },
    tone: "energetic",
    platformOptimizations: {
      maxLength: 300,
      hashtagCount: 8,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Follow for more tips!",
    },
    isActive: true,
  },
  {
    platform: "instagram",
    variant: 2,
    name: "Behind the Scenes",
    description: "Authentic, personal content showing real estate insights",
    structure: {
      hook: {
        type: "story",
        template: "POV: You're a real estate agent in [city] 🏠",
        examples: ["POV: You're a real estate agent in Austin 🏠"],
      },
      description: {
        template:
          "Here's what really happens: [real_situation]. The reality: [honest_insight]. What clients don't know: [behind_scenes].",
        maxLength: 250,
      },
      keyPoints: {
        template: "Have you experienced this? [engagement_question]",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "question",
        template: "Share your story below 👇 #RealEstate #BehindTheScenes",
        examples: ["Share your story below 👇"],
      },
    },
    tone: "casual",
    platformOptimizations: {
      maxLength: 350,
      hashtagCount: 6,
      emojiUsage: "heavy",
      lineBreaks: true,
      callToAction: "Share your experience!",
    },
    isActive: true,
  },
  {
    platform: "instagram",
    variant: 3,
    name: "Educational Tips",
    description: "Quick, actionable real estate tips with visual appeal",
    structure: {
      hook: {
        type: "question",
        template: "Real estate tip that will save you thousands 💰",
        examples: ["Real estate tip that will save you thousands 💰"],
      },
      description: {
        template:
          "Here's the secret: [tip_content]. This works because: [explanation]. Most people don't know: [insight].",
        maxLength: 200,
      },
      keyPoints: {
        template: "Save this for later! Follow for more tips 🔥",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "action",
        template: "Save this for later! Follow for more tips 🔥",
        examples: ["Save this for later!", "Follow for more tips 🔥"],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 300,
      hashtagCount: 7,
      emojiUsage: "heavy",
      lineBreaks: true,
      callToAction: "Follow for more tips!",
    },
    isActive: true,
  },
  {
    platform: "instagram",
    variant: 4,
    name: "Market Insights",
    description: "Data-driven content with market trends and statistics",
    structure: {
      hook: {
        type: "data",
        template: "New data reveals market trends about [topic] 📊",
        examples: [
          "New data reveals market trends about Austin luxury condos 📊",
        ],
      },
      description: {
        template:
          "The numbers: [data_insight]. This represents: [market_analysis]. What this means: [implication].",
        maxLength: 220,
      },
      keyPoints: {
        template: "What's your experience with this? [engagement_question]",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "What's your experience with this? [engagement_question]",
        examples: ["What's your experience with this?"],
      },
    },
    tone: "professional",
    platformOptimizations: {
      maxLength: 350,
      hashtagCount: 5,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your insights!",
    },
    isActive: true,
  },
  {
    platform: "instagram",
    variant: 5,
    name: "Lifestyle Focus",
    description: "Aspirational content connecting real estate to lifestyle",
    structure: {
      hook: {
        type: "provocative",
        template: "This number just changed everything for buyers 🔥",
        examples: ["This number just changed everything for buyers 🔥"],
      },
      description: {
        template:
          "Here's what I'm seeing: [market_insight]. This spells [lifestyle_benefit] for [target_audience]. Feel the [emotion] of [city] in a whole new way.",
        maxLength: 250,
      },
      keyPoints: {
        template:
          "Join the [lifestyle] lifestyle. DM me [social_handle] for more info 👩‍💻🔑",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "action",
        template:
          "Join the [lifestyle] lifestyle. DM me [social_handle] for more info 👩‍💻🔑",
        examples: ["Join the luxury lifestyle", "DM me for more info 👩‍💻🔑"],
      },
    },
    tone: "energetic",
    platformOptimizations: {
      maxLength: 300,
      hashtagCount: 7,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Join the lifestyle!",
    },
    isActive: true,
  },

  // ===== FACEBOOK TEMPLATES (5 variants) =====
  {
    platform: "facebook",
    variant: 1,
    name: "Community Discussion",
    description: "Conversational posts that encourage community engagement",
    structure: {
      hook: {
        type: "question",
        template:
          "What's your biggest challenge when [real_estate_activity] in [city]? 🤔",
        examples: [
          "What's your biggest challenge when buying a home in Austin? 🤔",
        ],
      },
      description: {
        template:
          "I hear this question a lot: [common_question]. Here's what I've learned: [insights]. The key is: [solution].",
        maxLength: 300,
      },
      keyPoints: {
        template: "What's your experience? [engagement_question].",
        maxPoints: 3,
      },
      conclusion: {
        ctaType: "collaborative",
        template:
          "Share your thoughts in the comments below! Let's help each other out 💬",
        examples: [
          "Share your thoughts in the comments below!",
          "Let's help each other out 💬",
        ],
      },
    },
    tone: "casual",
    platformOptimizations: {
      maxLength: 400,
      hashtagCount: 5,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Join the conversation!",
    },
    isActive: true,
  },
  {
    platform: "facebook",
    variant: 2,
    name: "Local Market Update",
    description: "Informative posts about local real estate market conditions",
    structure: {
      hook: {
        type: "bold_statement",
        template: "Hey [city] friends, quick update for local [audience] 👋",
        examples: ["Hey Austin friends, quick update for local buyers 👋"],
      },
      description: {
        template:
          "Here's what's happening in [city]: [market_update]. This means: [implication]. For [audience], this means: [specific_impact].",
        maxLength: 350,
      },
      keyPoints: {
        template: "Questions? Drop them below or DM me! 💬",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "Questions? Drop them below or DM me! 💬",
        examples: ["Questions? Drop them below!", "DM me! 💬"],
      },
    },
    tone: "casual",
    platformOptimizations: {
      maxLength: 450,
      hashtagCount: 4,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Ask questions!",
    },
    isActive: true,
  },
  {
    platform: "facebook",
    variant: 3,
    name: "Success Stories",
    description: "Inspirational posts sharing client success stories",
    structure: {
      hook: {
        type: "story",
        template: "Just closed another deal in [city]! 🎉",
        examples: ["Just closed another deal in Austin! 🎉"],
      },
      description: {
        template:
          "Here's what made this special: [success_factors]. The client: [client_story]. The result: [outcome].",
        maxLength: 300,
      },
      keyPoints: {
        template:
          "Ready to start your [city] real estate journey? [cta_question]",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "action",
        template:
          "Ready to start your [city] real estate journey? [cta_question]",
        examples: ["Ready to start your Austin real estate journey?"],
      },
    },
    tone: "energetic",
    platformOptimizations: {
      maxLength: 400,
      hashtagCount: 6,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Start your journey!",
    },
    isActive: true,
  },
  {
    platform: "facebook",
    variant: 4,
    name: "Educational Content",
    description: "Informative posts teaching real estate concepts",
    structure: {
      hook: {
        type: "question",
        template: "Ever wondered about [real_estate_concept] in [city]? 🤔",
        examples: ["Ever wondered about luxury condos in Austin? 🤔"],
      },
      description: {
        template:
          "Let me break it down: [explanation]. Here's what you need to know: [key_points]. The bottom line: [conclusion].",
        maxLength: 350,
      },
      keyPoints: {
        template: "Have questions? I'm here to help! 💬",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "Have questions? I'm here to help! 💬",
        examples: ["Have questions?", "I'm here to help! 💬"],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 450,
      hashtagCount: 4,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Ask questions!",
    },
    isActive: true,
  },
  {
    platform: "facebook",
    variant: 5,
    name: "Personal Insights",
    description: "Personal posts sharing agent experiences and insights",
    structure: {
      hook: {
        type: "story",
        template:
          "After [years] years in [city] real estate, here's what I've learned...",
        examples: [
          "After 10 years in Austin real estate, here's what I've learned...",
        ],
      },
      description: {
        template:
          "The biggest lesson: [key_lesson]. What surprised me: [surprise]. My advice: [advice].",
        maxLength: 300,
      },
      keyPoints: {
        template: "What's your biggest real estate lesson? Share below! 💭",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "What's your biggest real estate lesson? Share below! 💭",
        examples: [
          "What's your biggest real estate lesson?",
          "Share below! 💭",
        ],
      },
    },
    tone: "casual",
    platformOptimizations: {
      maxLength: 400,
      hashtagCount: 5,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Share your story!",
    },
    isActive: true,
  },

  // ===== LINKEDIN TEMPLATES (5 variants) =====
  {
    platform: "linkedin",
    variant: 1,
    name: "Professional Insights",
    description: "Thought leadership content for professional networking",
    structure: {
      hook: {
        type: "data",
        template: "New data reveals market trends about [topic] 📊",
        examples: [
          "New data reveals market trends about Austin luxury condos 📊",
        ],
      },
      description: {
        template:
          "The numbers: [data_insight]. This represents: [market_analysis]. What this means: [implication].",
        maxLength: 300,
      },
      keyPoints: {
        template:
          "What's your experience with this? Have you noticed similar patterns in your area?",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "collaborative",
        template:
          "What's your experience with this? Have you noticed similar patterns in your area?",
        examples: ["What's your experience with this?"],
      },
    },
    tone: "professional",
    platformOptimizations: {
      maxLength: 500,
      hashtagCount: 3,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your insights!",
    },
    isActive: true,
  },
  {
    platform: "linkedin",
    variant: 2,
    name: "Industry Analysis",
    description: "In-depth analysis of real estate industry trends",
    structure: {
      hook: {
        type: "bold_statement",
        template:
          "The real estate landscape just shifted. Here's what it means for [audience].",
        examples: [
          "The real estate landscape just shifted. Here's what it means for my clients.",
        ],
      },
      description: {
        template:
          "Here's my analysis: [analysis]. The implications: [implications]. For [audience]: [specific_impact].",
        maxLength: 400,
      },
      keyPoints: {
        template:
          "I'd love to hear your thoughts on this trend. What are you seeing in your market?",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "collaborative",
        template:
          "I'd love to hear your thoughts on this trend. What are you seeing in your market?",
        examples: ["I'd love to hear your thoughts on this trend."],
      },
    },
    tone: "professional",
    platformOptimizations: {
      maxLength: 600,
      hashtagCount: 4,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your analysis!",
    },
    isActive: true,
  },
  {
    platform: "linkedin",
    variant: 3,
    name: "Career Development",
    description: "Content focused on professional growth and career advice",
    structure: {
      hook: {
        type: "question",
        template:
          "Are you [real_estate_activity] in [city]? Here's everything you need to know about the process.",
        examples: [
          "Are you buying luxury condos in Austin? Here's everything you need to know about the process.",
        ],
      },
      description: {
        template:
          "In this post, I'll cover: [comprehensive_overview]. The key factors: [key_factors]. What this means: [implications].",
        maxLength: 350,
      },
      keyPoints: {
        template: "Subscribe for more real estate education! 🔔",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "action",
        template: "Subscribe for more real estate education! 🔔",
        examples: ["Subscribe for more real estate education! 🔔"],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 500,
      hashtagCount: 3,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Subscribe for more!",
    },
    isActive: true,
  },
  {
    platform: "linkedin",
    variant: 4,
    name: "Networking Focus",
    description: "Content designed to build professional relationships",
    structure: {
      hook: {
        type: "story",
        template:
          "After [years] years in [city] real estate, here's what I've learned about [topic]...",
        examples: [
          "After 10 years in Austin real estate, here's what I've learned about luxury condos...",
        ],
      },
      description: {
        template:
          "The biggest lesson: [key_lesson]. What surprised me: [surprise]. My advice: [advice].",
        maxLength: 300,
      },
      keyPoints: {
        template:
          "Connect with me to discuss [topic] and share your experiences!",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "collaborative",
        template:
          "Connect with me to discuss [topic] and share your experiences!",
        examples: ["Connect with me to discuss luxury condos!"],
      },
    },
    tone: "professional",
    platformOptimizations: {
      maxLength: 450,
      hashtagCount: 4,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Connect with me!",
    },
    isActive: true,
  },
  {
    platform: "linkedin",
    variant: 5,
    name: "Business Insights",
    description: "Content focused on business strategy and market intelligence",
    structure: {
      hook: {
        type: "data",
        template:
          "The [city] real estate market shows interesting patterns. Here's my analysis:",
        examples: [
          "The Austin real estate market shows interesting patterns. Here's my analysis:",
        ],
      },
      description: {
        template:
          "Key findings: [findings]. Market implications: [implications]. Strategic considerations: [considerations].",
        maxLength: 400,
      },
      keyPoints: {
        template: "What trends are you seeing in your market? Let's discuss!",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "What trends are you seeing in your market? Let's discuss!",
        examples: ["What trends are you seeing in your market?"],
      },
    },
    tone: "professional",
    platformOptimizations: {
      maxLength: 550,
      hashtagCount: 3,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Let's discuss!",
    },
    isActive: true,
  },

  // ===== TIKTOK TEMPLATES (5 variants) =====
  {
    platform: "tiktok",
    variant: 1,
    name: "Quick Tips",
    description: "Ultra-short, actionable real estate tips",
    structure: {
      hook: {
        type: "bold_statement",
        template: "Real estate tip that will save you thousands 💰",
        examples: ["Real estate tip that will save you thousands 💰"],
      },
      description: {
        template:
          "Here's the secret: [tip_content]. This works because: [explanation]. Most people don't know: [insight].",
        maxLength: 150,
      },
      keyPoints: {
        template: "Save this for later! Follow for more tips 🔥",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "action",
        template: "Save this for later! Follow for more tips 🔥",
        examples: ["Save this for later!", "Follow for more tips 🔥"],
      },
    },
    tone: "energetic",
    platformOptimizations: {
      maxLength: 200,
      hashtagCount: 7,
      emojiUsage: "heavy",
      lineBreaks: true,
      callToAction: "Follow for more tips!",
    },
    isActive: true,
  },
  {
    platform: "tiktok",
    variant: 2,
    name: "Behind the Scenes",
    description: "Quick, authentic glimpses into real estate work",
    structure: {
      hook: {
        type: "story",
        template: "POV: You're a real estate agent in [city] 🏠",
        examples: ["POV: You're a real estate agent in Austin 🏠"],
      },
      description: {
        template:
          "Here's what really happens: [real_situation]. The reality: [honest_insight]. What clients don't know: [behind_scenes].",
        maxLength: 180,
      },
      keyPoints: {
        template:
          "Have you experienced this? Share your story below 👇 #RealEstate #BehindTheScenes",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "question",
        template:
          "Have you experienced this? Share your story below 👇 #RealEstate #BehindTheScenes",
        examples: ["Have you experienced this?", "Share your story below 👇"],
      },
    },
    tone: "casual",
    platformOptimizations: {
      maxLength: 250,
      hashtagCount: 6,
      emojiUsage: "heavy",
      lineBreaks: true,
      callToAction: "Share your story!",
    },
    isActive: true,
  },
  {
    platform: "tiktok",
    variant: 3,
    name: "Trending Topics",
    description: "Content that taps into current trends and viral formats",
    structure: {
      hook: {
        type: "provocative",
        template: "This number just changed everything for buyers 🔥",
        examples: ["This number just changed everything for buyers 🔥"],
      },
      description: {
        template:
          "Here's what I'm seeing: [market_insight]. This spells [lifestyle_benefit] for [target_audience]. Feel the [emotion] of [city] in a whole new way.",
        maxLength: 200,
      },
      keyPoints: {
        template:
          "Join the [lifestyle] lifestyle. DM me [social_handle] for more info 👩‍💻🔑",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "action",
        template:
          "Join the [lifestyle] lifestyle. DM me [social_handle] for more info 👩‍💻🔑",
        examples: ["Join the luxury lifestyle", "DM me for more info 👩‍💻🔑"],
      },
    },
    tone: "energetic",
    platformOptimizations: {
      maxLength: 250,
      hashtagCount: 8,
      emojiUsage: "heavy",
      lineBreaks: true,
      callToAction: "Join the lifestyle!",
    },
    isActive: true,
  },
  {
    platform: "tiktok",
    variant: 4,
    name: "Quick Facts",
    description: "Fast-paced, fact-based content with visual appeal",
    structure: {
      hook: {
        type: "data",
        template: "New data reveals market trends about [topic] 📊",
        examples: [
          "New data reveals market trends about Austin luxury condos 📊",
        ],
      },
      description: {
        template:
          "The numbers: [data_insight]. This represents: [market_analysis]. What this means: [implication].",
        maxLength: 180,
      },
      keyPoints: {
        template: "What's your experience with this? [engagement_question]",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "What's your experience with this? [engagement_question]",
        examples: ["What's your experience with this?"],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 220,
      hashtagCount: 6,
      emojiUsage: "moderate",
      lineBreaks: true,
      callToAction: "Share your insights!",
    },
    isActive: true,
  },
  {
    platform: "tiktok",
    variant: 5,
    name: "Lifestyle Content",
    description: "Aspirational content connecting real estate to lifestyle",
    structure: {
      hook: {
        type: "bold_statement",
        template: "This just changed everything for [topic]! 🔥",
        examples: ["This just changed everything for Austin real estate! 🔥"],
      },
      description: {
        template:
          "Here's what I'm seeing in [city]: [key_points]. This means [implication] for [target_audience].",
        maxLength: 200,
      },
      keyPoints: {
        template: "Save this for later 📌 Tag someone who needs to see this 👥",
        maxPoints: 2,
      },
      conclusion: {
        ctaType: "action",
        template: "Save this for later 📌 Tag someone who needs to see this 👥",
        examples: [
          "Save this for later 📌",
          "Tag someone who needs to see this 👥",
        ],
      },
    },
    tone: "energetic",
    platformOptimizations: {
      maxLength: 250,
      hashtagCount: 7,
      emojiUsage: "heavy",
      lineBreaks: true,
      callToAction: "Save and share!",
    },
    isActive: true,
  },

  // ===== YOUTUBE TEMPLATES (5 variants) =====
  {
    platform: "youtube",
    variant: 1,
    name: "Educational Series",
    description: "Comprehensive educational content for YouTube",
    structure: {
      hook: {
        type: "question",
        template:
          "Are you [real_estate_activity] in [city]? Here's everything you need to know about the process.",
        examples: [
          "Are you buying luxury condos in Austin? Here's everything you need to know about the process.",
        ],
      },
      description: {
        template:
          "In this video, I'll cover: [comprehensive_overview]. The key factors: [key_factors]. What this means: [implications].",
        maxLength: 400,
      },
      keyPoints: {
        template: "Subscribe for more real estate education! 🔔",
        maxPoints: 3,
      },
      conclusion: {
        ctaType: "action",
        template: "Subscribe for more real estate education! 🔔",
        examples: ["Subscribe for more real estate education! 🔔"],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 600,
      hashtagCount: 12,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Subscribe for more!",
    },
    isActive: true,
  },
  {
    platform: "youtube",
    variant: 2,
    name: "Market Analysis",
    description: "In-depth market analysis and trend discussions",
    structure: {
      hook: {
        type: "data",
        template:
          "The [city] real estate market shows interesting patterns. Here's my analysis:",
        examples: [
          "The Austin real estate market shows interesting patterns. Here's my analysis:",
        ],
      },
      description: {
        template:
          "Key findings: [findings]. Market implications: [implications]. Strategic considerations: [considerations].",
        maxLength: 500,
      },
      keyPoints: {
        template:
          "What trends are you seeing in your market? Let's discuss in the comments!",
        maxPoints: 3,
      },
      conclusion: {
        ctaType: "collaborative",
        template:
          "What trends are you seeing in your market? Let's discuss in the comments!",
        examples: ["What trends are you seeing in your market?"],
      },
    },
    tone: "professional",
    platformOptimizations: {
      maxLength: 700,
      hashtagCount: 10,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Let's discuss!",
    },
    isActive: true,
  },
  {
    platform: "youtube",
    variant: 3,
    name: "Tutorial Content",
    description: "Step-by-step tutorials and guides",
    structure: {
      hook: {
        type: "bold_statement",
        template:
          "The real estate landscape just shifted. Here's what it means for [audience].",
        examples: [
          "The real estate landscape just shifted. Here's what it means for my clients.",
        ],
      },
      description: {
        template:
          "Here's my analysis: [analysis]. The implications: [implications]. For [audience]: [specific_impact].",
        maxLength: 450,
      },
      keyPoints: {
        template:
          "I'd love to hear your thoughts on this trend. What are you seeing in your market?",
        maxPoints: 3,
      },
      conclusion: {
        ctaType: "collaborative",
        template:
          "I'd love to hear your thoughts on this trend. What are you seeing in your market?",
        examples: ["I'd love to hear your thoughts on this trend."],
      },
    },
    tone: "professional",
    platformOptimizations: {
      maxLength: 650,
      hashtagCount: 8,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Share your analysis!",
    },
    isActive: true,
  },
  {
    platform: "youtube",
    variant: 4,
    name: "Case Studies",
    description: "Real case studies and success stories",
    structure: {
      hook: {
        type: "story",
        template:
          "After [years] years in [city] real estate, here's what I've learned about [topic]...",
        examples: [
          "After 10 years in Austin real estate, here's what I've learned about luxury condos...",
        ],
      },
      description: {
        template:
          "The biggest lesson: [key_lesson]. What surprised me: [surprise]. My advice: [advice].",
        maxLength: 400,
      },
      keyPoints: {
        template:
          "Connect with me to discuss [topic] and share your experiences!",
        maxPoints: 3,
      },
      conclusion: {
        ctaType: "collaborative",
        template:
          "Connect with me to discuss [topic] and share your experiences!",
        examples: ["Connect with me to discuss luxury condos!"],
      },
    },
    tone: "professional",
    platformOptimizations: {
      maxLength: 600,
      hashtagCount: 9,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Connect with me!",
    },
    isActive: true,
  },
  {
    platform: "youtube",
    variant: 5,
    name: "Industry Insights",
    description: "Thought leadership content for YouTube audience",
    structure: {
      hook: {
        type: "question",
        template: "Ever wondered about [real_estate_concept] in [city]? 🤔",
        examples: ["Ever wondered about luxury condos in Austin? 🤔"],
      },
      description: {
        template:
          "Let me break it down: [explanation]. Here's what you need to know: [key_points]. The bottom line: [conclusion].",
        maxLength: 450,
      },
      keyPoints: {
        template: "Have questions? I'm here to help! 💬",
        maxPoints: 3,
      },
      conclusion: {
        ctaType: "collaborative",
        template: "Have questions? I'm here to help! 💬",
        examples: ["Have questions?", "I'm here to help! 💬"],
      },
    },
    tone: "educational",
    platformOptimizations: {
      maxLength: 650,
      hashtagCount: 11,
      emojiUsage: "minimal",
      lineBreaks: true,
      callToAction: "Ask questions!",
    },
    isActive: true,
  },
];

async function initializeDynamicTemplates(): Promise<void> {
  try {
    console.log("🚀 Initializing 25 Dynamic Templates...");

    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/edge-ai";
    console.log(`📡 Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Clear existing templates
    await ContentTemplate.deleteMany({});
    console.log("🗑️ Cleared existing templates");

    // Add templates one by one
    let addedCount = 0;
    for (const template of templates) {
      try {
        const newTemplate = new ContentTemplate(template);
        await newTemplate.save();
        addedCount++;
        console.log(
          `✅ Added template: ${template.platform} variant ${template.variant} - ${template.name}`
        );
      } catch (error) {
        console.warn(
          `⚠️ Failed to add ${template.platform} variant ${template.variant}:`,
          error
        );
      }
    }

    console.log(`✅ Successfully added ${addedCount} templates`);

    // Show summary by platform
    const platformCounts: any = templates.reduce((acc: any, template) => {
      acc[template.platform] = (acc[template.platform] || 0) + 1;
      return acc;
    }, {});

    console.log("📊 Templates by platform:");
    Object.entries(platformCounts).forEach(([platform, count]) => {
      console.log(`  ${platform}: ${count} templates`);
    });

    console.log("🎉 Template Rotation Engine initialized successfully!");
    console.log("💡 System now has templates across 5 platforms!");
    console.log("💡 Each platform has unique template variants!");
  } catch (error) {
    console.error("❌ Error initializing templates:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the script
if (require.main === module) {
  initializeDynamicTemplates()
    .then(() => {
      console.log("✅ Template initialization completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Initialization failed:", error);
      process.exit(1);
    });
}

export default initializeDynamicTemplates;
