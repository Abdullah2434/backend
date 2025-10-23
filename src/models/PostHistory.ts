import mongoose, { Document, Schema } from "mongoose";

export interface IPostHistory extends Document {
  userId: string;
  platform: string;
  templateUsed: string;
  hookType: string;
  toneStyle: string;
  ctaType: string;
  content: string;
  topicType: string;
  videoId?: string;
  scheduleId?: string;
  trendIndex?: number;
  postedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PostHistorySchema = new Schema<IPostHistory>(
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
    templateUsed: {
      type: String,
      required: true,
      index: true,
    },
    hookType: {
      type: String,
      required: true,
      enum: ["question", "bold_statement", "story", "data", "provocative"],
    },
    toneStyle: {
      type: String,
      required: true,
      enum: ["casual", "professional", "educational", "energetic"],
    },
    ctaType: {
      type: String,
      required: true,
      enum: ["question", "collaborative", "action", "share"],
    },
    content: {
      type: String,
      required: true,
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
    videoId: {
      type: String,
      index: true,
    },
    scheduleId: {
      type: String,
      index: true,
    },
    trendIndex: {
      type: Number,
    },
    postedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
PostHistorySchema.index({ userId: 1, platform: 1, postedAt: -1 });
PostHistorySchema.index({ userId: 1, platform: 1, templateUsed: 1 });
PostHistorySchema.index({ userId: 1, platform: 1, hookType: 1 });
PostHistorySchema.index({ userId: 1, platform: 1, topicType: 1 });

export default mongoose.model<IPostHistory>("PostHistory", PostHistorySchema);
