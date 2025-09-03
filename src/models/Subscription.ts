import mongoose, { Schema, Document } from "mongoose";

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: "active" | "canceled" | "past_due" | "unpaid" | "pending";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  videoCount: number;
  videoLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planId: {
      type: String,
      required: true,
      enum: ["basic", "growth", "professional"],
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
      unique: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "canceled", "past_due", "unpaid", "pending"],
      default: "active",
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    videoCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    videoLimit: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient querying
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ stripeCustomerId: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });
subscriptionSchema.index({ planId: 1, status: 1 });

// Virtual for checking if subscription is active
subscriptionSchema.virtual("isActive").get(function (this: any) {
  return this.status === "active" && new Date() <= this.currentPeriodEnd;
});

// Virtual for checking if user can create more videos
subscriptionSchema.virtual("canCreateVideo").get(function (this: any) {
  return this.isActive && this.videoCount < this.videoLimit;
});

// Virtual for remaining video count
subscriptionSchema.virtual("remainingVideos").get(function (this: any) {
  return Math.max(0, this.videoLimit - this.videoCount);
});

export default mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", subscriptionSchema);
