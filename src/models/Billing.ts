import mongoose, { Schema, Document } from "mongoose";

export interface IBilling extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: string;
  stripeInvoiceId: string;
  stripePaymentIntentId?: string;
  description: string;
  subscriptionId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const billingSchema = new Schema<IBilling>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "usd",
      uppercase: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "succeeded", "failed", "canceled", "open"],
      default: "pending",
    },
    stripeInvoiceId: {
      type: String,
      required: true,
      unique: true,
    },
    stripePaymentIntentId: {
      type: String,
      sparse: true,
    },
    description: {
      type: String,
      required: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient querying
billingSchema.index({ userId: 1, createdAt: -1 });
billingSchema.index({ status: 1, createdAt: -1 });
billingSchema.index({ subscriptionId: 1, createdAt: -1 });

// Virtual for formatted amount
billingSchema.virtual("formattedAmount").get(function (this: any) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: this.currency.toUpperCase(),
  }).format(this.amount / 100); // Stripe amounts are in cents
});

export default mongoose.models.Billing ||
  mongoose.model<IBilling>("Billing", billingSchema);
