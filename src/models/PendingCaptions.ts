import mongoose, { Schema, Document } from "mongoose";

export interface IPendingCaptions extends Document {
  email: string;
  title: string;
  captions: {
    instagram_caption?: string;
    facebook_caption?: string;
    linkedin_caption?: string;
    twitter_caption?: string;
    tiktok_caption?: string;
    youtube_caption?: string;
  };
  // New fields for dynamic generation tracking
  topic?: string;
  keyPoints?: string;
  userContext?: {
    name: string;
    position: string;
    companyName: string;
    city: string;
    socialHandles: string;
  };
  userId?: string;
  platforms?: string[];
  isDynamic?: boolean;
  isPending?: boolean;
  dynamicPosts?: any[];
  createdAt: Date;
  updatedAt: Date;
}

const PendingCaptionsSchema = new Schema<IPendingCaptions>(
  {
    email: { type: String, required: true, index: true, trim: true },
    title: { type: String, required: true, index: true, trim: true },
    captions: {
      instagram_caption: { type: String, trim: true },
      facebook_caption: { type: String, trim: true },
      linkedin_caption: { type: String, trim: true },
      twitter_caption: { type: String, trim: true },
      tiktok_caption: { type: String, trim: true },
      youtube_caption: { type: String, trim: true },
    },
    // New fields for dynamic generation tracking
    topic: { type: String, trim: true },
    keyPoints: { type: String, trim: true },
    userContext: {
      name: { type: String, trim: true },
      position: { type: String, trim: true },
      companyName: { type: String, trim: true },
      city: { type: String, trim: true },
      socialHandles: { type: String, trim: true },
    },
    userId: { type: String, trim: true },
    platforms: [{ type: String }],
    isDynamic: { type: Boolean, default: false },
    isPending: { type: Boolean, default: false },
    dynamicPosts: [{ type: Schema.Types.Mixed }],
  },
  { timestamps: true }
);

PendingCaptionsSchema.index({ email: 1, title: 1 }, { unique: true });

export default mongoose.models.PendingCaptions ||
  mongoose.model<IPendingCaptions>("PendingCaptions", PendingCaptionsSchema);
