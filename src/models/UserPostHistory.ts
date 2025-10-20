import mongoose, { Document, Schema } from "mongoose";

export interface IUserPostHistory extends Document {
  userId: string;
  platform: string; // 'youtube', 'instagram', 'tiktok', 'facebook', 'linkedin'
  postId: string;
  videoTopic: string;
  createdAt: Date;

  // Template metadata
  templateVariant: number; // 1-5
  topicCategory: string; // 'market_update', 'tips', 'local_news', 'industry_analysis'
  toneUsed: string; // 'analytical', 'consultative', 'conversational', 'provocative'
  hookType: string; // 'question', 'bold_statement', 'story', 'data', 'provocative'
  ctaType: string; // 'question', 'collaborative', 'action', 'share'
  structuralFormat: string;

  // Content excerpts for avoidance
  openingSentence: string;
  ctaText: string;
  fullCaption: string;

  // Performance tracking
  engagementScore?: number;
  reachScore?: number;
  conversionScore?: number;
  performanceRecordedAt?: Date;
}

const UserPostHistorySchema = new Schema<IUserPostHistory>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ["youtube", "instagram", "tiktok", "facebook", "linkedin"],
      index: true,
    },
    postId: {
      type: String,
      required: true,
      unique: true,
    },
    videoTopic: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Template metadata
    templateVariant: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    topicCategory: {
      type: String,
      required: true,
      enum: ["market_update", "tips", "local_news", "industry_analysis"],
    },
    toneUsed: {
      type: String,
      required: true,
    },
    hookType: {
      type: String,
      required: true,
      enum: ["question", "bold_statement", "story", "data", "provocative"],
    },
    ctaType: {
      type: String,
      required: true,
      enum: ["question", "collaborative", "action", "share"],
    },
    structuralFormat: {
      type: String,
      required: true,
    },

    // Content excerpts for avoidance
    openingSentence: {
      type: String,
      required: true,
    },
    ctaText: {
      type: String,
      required: true,
    },
    fullCaption: {
      type: String,
      required: true,
    },

    // Performance tracking
    engagementScore: {
      type: Number,
      default: null,
    },
    reachScore: {
      type: Number,
      default: null,
    },
    conversionScore: {
      type: Number,
      default: null,
    },
    performanceRecordedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
UserPostHistorySchema.index({ userId: 1, platform: 1 });
UserPostHistorySchema.index({ userId: 1, createdAt: -1 });
UserPostHistorySchema.index({ userId: 1, platform: 1, createdAt: -1 });

// Static methods for querying post history
UserPostHistorySchema.statics.getPostHistory = function (
  userId: string,
  platform: string,
  limit: number = 10
) {
  return this.find({ userId, platform })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select(
      "templateVariant topicCategory toneUsed hookType ctaType structuralFormat openingSentence ctaText createdAt"
    )
    .lean();
};

UserPostHistorySchema.statics.getRecentVariants = function (
  userId: string,
  platform: string,
  limit: number = 2
) {
  return this.find({ userId, platform })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("templateVariant")
    .lean();
};

UserPostHistorySchema.statics.getRecentTones = function (
  userId: string,
  platform: string,
  limit: number = 2
) {
  return this.find({ userId, platform })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("toneUsed")
    .lean();
};

UserPostHistorySchema.statics.getRecentHooks = function (
  userId: string,
  platform: string,
  limit: number = 3
) {
  return this.find({ userId, platform })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("hookType")
    .lean();
};

UserPostHistorySchema.statics.getLastCTA = function (
  userId: string,
  platform: string
) {
  return this.findOne({ userId, platform })
    .sort({ createdAt: -1 })
    .select("ctaType")
    .lean();
};

UserPostHistorySchema.statics.getRecentOpenings = function (
  userId: string,
  platform: string,
  limit: number = 3
) {
  return this.find({ userId, platform })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("openingSentence")
    .lean();
};

UserPostHistorySchema.statics.getRecentCTAs = function (
  userId: string,
  platform: string,
  limit: number = 2
) {
  return this.find({ userId, platform })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("ctaText")
    .lean();
};

export default mongoose.model<IUserPostHistory>(
  "UserPostHistory",
  UserPostHistorySchema
);
