import mongoose, { Document, Schema } from "mongoose";

export interface IContentTemplate extends Document {
  id: string;
  platform: string;
  variant: number;
  hookType: string;
  toneStyle: string;
  ctaType: string;
  template: string;
  usageCount: number;
  successRate: number;
  averageEngagement: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContentTemplateSchema = new Schema<IContentTemplate>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ["youtube", "instagram", "tiktok", "facebook", "linkedin"],
      index: true,
    },
    variant: {
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
    template: {
      type: String,
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    successRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    averageEngagement: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
ContentTemplateSchema.index({ platform: 1, variant: 1 });
ContentTemplateSchema.index({ platform: 1, hookType: 1 });
ContentTemplateSchema.index({ platform: 1, toneStyle: 1 });
ContentTemplateSchema.index({ platform: 1, ctaType: 1 });

export default mongoose.model<IContentTemplate>(
  "ContentTemplate",
  ContentTemplateSchema
);
