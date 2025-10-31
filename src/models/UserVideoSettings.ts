import mongoose, { Schema, Document } from "mongoose";

export interface AvatarObject {
  avatar_id: string;
  avatarType: string;
}

export interface IUserVideoSettings extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  email: string;
  prompt: string;
  avatar: string[]; // Array of avatar IDs (strings)
  titleAvatar: AvatarObject | string; // Can be object with avatar_id and avatarType, or string (for backward compatibility)
  conclusionAvatar: AvatarObject | string; // Can be object with avatar_id and avatarType, or string (for backward compatibility)
  bodyAvatar?: AvatarObject | string; // Optional body avatar
  name: string;
  position: string;
  companyName: string;
  license: string;
  tailoredFit: string;
  socialHandles: string;
  city: string;
  preferredTone: string;
  callToAction: string;
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
      type: Schema.Types.Mixed, // Can be String or Object {avatar_id, avatarType}
      required: true,
    },
    conclusionAvatar: {
      type: Schema.Types.Mixed, // Can be String or Object {avatar_id, avatarType}
      required: true,
    },
    bodyAvatar: {
      type: Schema.Types.Mixed, // Can be String or Object {avatar_id, avatarType}
      required: false,
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
