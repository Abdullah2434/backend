import mongoose, { Schema, Document } from "mongoose";

export interface IElevenLabsVoice extends Document {
  voice_id: string;
  name: string;
  category: string;
  gender: string;
  age: string;
  preview_url: string;
  description?: string;
  descriptive?: string;
  use_case?: string;
  energy?: "low" | "medium" | "high";
  energy_conclusion?: string;
  verified_language_es?: {
    language: string;
    model_id: string;
    accent: string;
    locale: string;
    preview_url: string;
  };
  verified_language_en?: {
    language: string;
    model_id: string;
    accent: string;
    locale: string;
    preview_url: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const elevenLabsVoiceSchema = new Schema<IElevenLabsVoice>(
  {
    voice_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      required: true,
    },
    age: {
      type: String,
      required: true,
    },
    preview_url: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    descriptive: {
      type: String,
      required: false,
      index: true,
    },
    use_case: {
      type: String,
      required: false,
      index: true,
    },
    energy: {
      type: String,
      enum: ["low", "medium", "high"],
      required: false,
      index: true,
    },
    energy_conclusion: {
      type: String,
      required: false,
    },
    verified_language_es: {
      language: { type: String },
      model_id: { type: String },
      accent: { type: String },
      locale: { type: String },
      preview_url: { type: String },
    },
    verified_language_en: {
      language: { type: String },
      model_id: { type: String },
      accent: { type: String },
      locale: { type: String },
      preview_url: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

elevenLabsVoiceSchema.index({ voice_id: 1 });
elevenLabsVoiceSchema.index({ category: 1 });

export default mongoose.models.ElevenLabsVoice ||
  mongoose.model<IElevenLabsVoice>("ElevenLabsVoice", elevenLabsVoiceSchema);
