import mongoose, { Schema, Document } from "mongoose";

export interface IVideoWebhookStatus extends Document {
  videoId: string;
  email: string;
  title: string;
  // Track completion of different webhook types
  videoWebhookCompleted: boolean;
  captionWebhookCompleted: boolean;
  // Overall status
  allWebhooksCompleted: boolean;
  // Timestamps
  videoWebhookCompletedAt?: Date;
  captionWebhookCompletedAt?: Date;
  allWebhooksCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VideoWebhookStatusSchema = new Schema<IVideoWebhookStatus>(
  {
    videoId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    title: { type: String, required: true, index: true },
    videoWebhookCompleted: { type: Boolean, default: false },
    captionWebhookCompleted: { type: Boolean, default: false },
    allWebhooksCompleted: { type: Boolean, default: false },
    videoWebhookCompletedAt: { type: Date },
    captionWebhookCompletedAt: { type: Date },
    allWebhooksCompletedAt: { type: Date },
  },
  { timestamps: true }
);

// Index for efficient querying
VideoWebhookStatusSchema.index({ videoId: 1 });
VideoWebhookStatusSchema.index({ email: 1, title: 1 });
VideoWebhookStatusSchema.index({ allWebhooksCompleted: 1 });

export default mongoose.models.VideoWebhookStatus ||
  mongoose.model<IVideoWebhookStatus>(
    "VideoWebhookStatus",
    VideoWebhookStatusSchema
  );

