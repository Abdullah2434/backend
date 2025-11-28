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
  userId?: mongoose.Types.ObjectId; // Link to user who created the voice
  createdAt: Date;
  updatedAt: Date;
}

const elevenLabsVoiceSchema = new Schema<IElevenLabsVoice>(
  {
    voice_id: {
      type: String,
      required: true,
      unique: true,
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
    },
    use_case: {
      type: String,
      required: false,
    },
    energy: {
      type: String,
      enum: ["low", "medium", "high"],
      required: false,
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Note: voice_id already has an index from unique: true
elevenLabsVoiceSchema.index({ category: 1 });

export default mongoose.models.ElevenLabsVoice ||
  mongoose.model<IElevenLabsVoice>("ElevenLabsVoice", elevenLabsVoiceSchema);
