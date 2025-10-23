import mongoose, { Document, Schema } from "mongoose";

export interface IUserContentProfile extends Document {
  userId: string;
  platform: string;
  lastUsedTemplates: string[];
  preferredHooks: string[];
  contentStyle: string;
  totalPosts: number;
  lastPostDate: Date;
  averageEngagement: number;
  bestPerformingTemplate: string;
  worstPerformingTemplate: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserContentProfileSchema = new Schema<IUserContentProfile>(
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
    lastUsedTemplates: [
      {
        type: String,
        maxlength: 10, // Keep only last 10 templates
      },
    ],
    preferredHooks: [
      {
        type: String,
        enum: ["question", "bold_statement", "story", "data", "provocative"],
      },
    ],
    contentStyle: {
      type: String,
      enum: ["casual", "professional", "educational", "energetic"],
      default: "professional",
    },
    totalPosts: {
      type: Number,
      default: 0,
    },
    lastPostDate: {
      type: Date,
      default: Date.now,
    },
    averageEngagement: {
      type: Number,
      default: 0,
    },
    bestPerformingTemplate: {
      type: String,
      default: "",
    },
    worstPerformingTemplate: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index
UserContentProfileSchema.index({ userId: 1, platform: 1 }, { unique: true });

export default mongoose.model<IUserContentProfile>(
  "UserContentProfile",
  UserContentProfileSchema
);
