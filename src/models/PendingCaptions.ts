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
  };
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
    },
  },
  { timestamps: true }
);

PendingCaptionsSchema.index({ email: 1, title: 1 }, { unique: true });

export default mongoose.models.PendingCaptions ||
  mongoose.model<IPendingCaptions>("PendingCaptions", PendingCaptionsSchema);
