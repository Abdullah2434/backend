import mongoose, { Schema, Document } from "mongoose";

export interface IUserPostHistory extends Document {
  userId: mongoose.Types.ObjectId;
  platform:
    | "instagram"
    | "facebook"
    | "linkedin"
    | "twitter"
    | "tiktok"
    | "youtube";
  topic: string;
  topicType:
    | "market_update"
    | "tips"
    | "local_news"
    | "industry_analysis"
    | "general";
  templateVariant: number; // 1-5 for each platform
  hookType: "question" | "bold_statement" | "story" | "data" | "provocative";
  tone:
    | "casual"
    | "professional"
    | "educational"
    | "energetic"
    | "storytelling"
    | "analytical"
    | "provocative"
    | "relatable"
    | "ultra_casual"
    | "edgy"
    | "entertaining"
    | "authentic"
    | "friendly"
    | "community_focused"
    | "helpful"
    | "conversational"
    | "consultative";
  ctaType: "question" | "collaborative" | "action" | "share" | "provocative";
  openingSentence: string;
  cta: string;
  hashtags: string[];
  contentStructure: {
    hook: string;
    description: string;
    keyPoints: string[];
    conclusion: string;
  };
  metadata: {
    characterCount: number;
    hashtagCount: number;
    emojiCount: number;
    engagementScore?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userPostHistorySchema = new Schema<IUserPostHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: [
        "instagram",
        "facebook",
        "linkedin",
        "twitter",
        "tiktok",
        "youtube",
      ],
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    topicType: {
      type: String,
      required: true,
      enum: [
        "market_update",
        "tips",
        "local_news",
        "industry_analysis",
        "general",
      ],
    },
    templateVariant: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    hookType: {
      type: String,
      required: true,
      enum: ["question", "bold_statement", "story", "data", "provocative"],
    },
    tone: {
      type: String,
      required: true,
      enum: [
        "casual",
        "professional",
        "educational",
        "energetic",
        "storytelling",
        "analytical",
        "provocative",
        "relatable",
        "ultra_casual",
        "edgy",
        "entertaining",
        "authentic",
        "friendly",
        "community_focused",
        "helpful",
        "conversational",
        "consultative",
      ],
    },
    ctaType: {
      type: String,
      required: true,
      enum: ["question", "collaborative", "action", "share", "provocative"],
    },
    openingSentence: {
      type: String,
      required: true,
      trim: true,
    },
    cta: {
      type: String,
      required: true,
      trim: true,
    },
    hashtags: [String],
    contentStructure: {
      hook: {
        type: String,
        required: true,
        trim: true,
      },
      description: {
        type: String,
        required: true,
        trim: true,
      },
      keyPoints: [String],
      conclusion: {
        type: String,
        required: true,
        trim: true,
      },
    },
    metadata: {
      characterCount: {
        type: Number,
        required: true,
      },
      hashtagCount: {
        type: Number,
        required: true,
      },
      emojiCount: {
        type: Number,
        required: true,
      },
      engagementScore: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create indexes for efficient queries
userPostHistorySchema.index({ userId: 1, platform: 1 });
userPostHistorySchema.index({ userId: 1, createdAt: -1 });
userPostHistorySchema.index({ platform: 1, createdAt: -1 });

export default mongoose.models.UserPostHistory ||
  mongoose.model<IUserPostHistory>("UserPostHistory", userPostHistorySchema);
