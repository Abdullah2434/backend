import mongoose, { Schema, Document } from "mongoose";

export interface IVideoSchedule extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  email: string;
  timezone: string;
  frequency: "once_week" | "twice_week" | "three_week" | "daily";
  schedule: {
    // For once_week: single day and time
    // For twice_week: two days and times
    // For three_week: three days and times
    // For daily: single time
    days: string[]; // ["monday", "tuesday", etc.]
    times: string[]; // ["09:00", "14:30", etc.] in HH:MM format
  };
  isActive: boolean;
  status: "processing" | "ready" | "failed"; // Schedule creation status
  startDate: Date;
  endDate: Date;
  generatedTrends: Array<{
    description: string;
    keypoints: string;
    instagram_caption: string;
    facebook_caption: string;
    linkedin_caption: string;
    twitter_caption: string;
    tiktok_caption: string;
    youtube_caption: string;
    scheduledFor: Date;
    status: "pending" | "processing" | "completed" | "failed";
    videoId?: string;
    enhanced_with_dynamic_posts?: boolean;
    caption_status?: "pending" | "ready" | "failed";
    caption_processed_at?: Date;
    caption_error?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const videoScheduleSchema = new Schema<IVideoSchedule>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    timezone: {
      type: String,
      required: true,
      default: "UTC",
      trim: true,
    },
    frequency: {
      type: String,
      required: true,
      enum: ["once_week", "twice_week", "three_week", "daily"],
    },
    schedule: {
      days: [
        {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
        },
      ],
      times: [
        {
          type: String,
          match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
        },
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "processing",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    generatedTrends: [
      {
        description: {
          type: String,
          required: true,
        },
        keypoints: {
          type: String,
          required: true,
        },
        instagram_caption: {
          type: String,
          required: true,
        },
        facebook_caption: {
          type: String,
          required: true,
        },
        linkedin_caption: {
          type: String,
          required: true,
        },
        twitter_caption: {
          type: String,
          required: true,
        },
        tiktok_caption: {
          type: String,
          required: true,
        },
        youtube_caption: {
          type: String,
          required: true,
        },
        scheduledFor: {
          type: Date,
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "processing", "completed", "failed"],
          default: "pending",
        },
        videoId: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
videoScheduleSchema.index({ userId: 1 });
videoScheduleSchema.index({ email: 1 });
videoScheduleSchema.index({ isActive: 1 });
videoScheduleSchema.index({ "generatedTrends.scheduledFor": 1 });
videoScheduleSchema.index({ "generatedTrends.status": 1 });

export default mongoose.models.VideoSchedule ||
  mongoose.model<IVideoSchedule>("VideoSchedule", videoScheduleSchema);
