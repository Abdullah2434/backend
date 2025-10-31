import mongoose, { Schema, Document } from "mongoose";

export interface IUserVideoSettings extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  email: string;
  prompt: string;
  avatar: string[];
  titleAvatar: string;
  conclusionAvatar: string;
  name: string;
  position: string;
  companyName: string;
  license: string;
  tailoredFit: string;
  socialHandles: string;
  city: string;
  preferredTone: string;
  callToAction: string;
  voiceEnergy?: "high" | "mid" | "low";
  musicEnergy?: "high" | "mid" | "low";
  selectedMusicTrackId?: mongoose.Types.ObjectId;
  customVoiceMusic?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userVideoSettingsSchema = new Schema<IUserVideoSettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: [
      {
        type: String,
        required: true,
        trim: true,
      },
    ],
    titleAvatar: {
      type: String,
      required: true,
      trim: true,
    },
    conclusionAvatar: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    position: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    license: {
      type: String,
      required: true,
      trim: true,
    },
    tailoredFit: {
      type: String,
      required: true,
      trim: true,
    },
    socialHandles: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    preferredTone: {
      type: String,
      required: true,
      trim: true,
    },
    callToAction: {
      type: String,
      required: true,
      trim: true,
    },
    voiceEnergy: {
      type: String,
      enum: ["high", "mid", "low"],
      default: "mid",
    },
    musicEnergy: {
      type: String,
      enum: ["high", "mid", "low"],
      default: "mid",
    },
    selectedMusicTrackId: {
      type: Schema.Types.ObjectId,
      ref: "MusicTrack",
    },
    customVoiceMusic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
userVideoSettingsSchema.index({ userId: 1 });
userVideoSettingsSchema.index({ email: 1 });

export default mongoose.models.UserVideoSettings ||
  mongoose.model<IUserVideoSettings>(
    "UserVideoSettings",
    userVideoSettingsSchema
  );
