import mongoose, { Schema, Document } from "mongoose";

export interface IVideoCreation extends Document {
  _id: mongoose.Types.ObjectId;
  requestId: string;
  userId?: mongoose.Types.ObjectId;
  email: string;
  title?: string;
  prompt: string;
  avatar: string[];
  name: string;
  position: string;
  companyName: string;
  license: string;
  tailoredFit: string;
  socialHandles: string;
  videoTopic: string;
  topicKeyPoints: string;
  city: string;
  preferredTone: string;
  callToAction: string;
  status: "pending" | "processing" | "completed" | "failed";
  webhookUrl?: string;
  webhookResponse?: any;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const videoCreationSchema = new Schema<IVideoCreation>(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
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
    videoTopic: {
      type: String,
      required: true,
      trim: true,
    },
    topicKeyPoints: {
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
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    webhookUrl: {
      type: String,
      trim: true,
    },
    webhookResponse: {
      type: Schema.Types.Mixed,
    },
    errorMessage: {
      type: String,
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
videoCreationSchema.index({ userId: 1, createdAt: -1 });
videoCreationSchema.index({ email: 1, createdAt: -1 });
videoCreationSchema.index({ status: 1, createdAt: -1 });
videoCreationSchema.index({ requestId: 1 });

export default mongoose.models.VideoCreation ||
  mongoose.model<IVideoCreation>("VideoCreation", videoCreationSchema);
