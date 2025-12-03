import mongoose, { Schema, Document } from "mongoose";

export interface IUserAvatarVideos extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  consentVideoDriveId?: string;
  trainingVideoDriveId?: string;
  isAvatarCreated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userAvatarVideosSchema = new Schema<IUserAvatarVideos>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    consentVideoDriveId: {
      type: String,
      trim: true,
    },
    trainingVideoDriveId: {
      type: String,
      trim: true,
    },
    isAvatarCreated: {
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

// Create index on userId for efficient queries (non-unique to allow multiple records)
userAvatarVideosSchema.index({ userId: 1 });

export default mongoose.models.UserAvatarVideos ||
  mongoose.model<IUserAvatarVideos>("UserAvatarVideos", userAvatarVideosSchema);

