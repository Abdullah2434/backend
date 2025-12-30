import mongoose, { Schema, Document } from "mongoose";

export interface IMusicTrack extends Document {
  _id: mongoose.Types.ObjectId;
  trackId: string;
  name: string;
  energyCategory: "high" | "mid" | "low" | "custom";
  s3FullTrackUrl: string;
  s3PreviewUrl: string;
  duration: number;
  userId?: mongoose.Types.ObjectId;
  metadata: {
    artist?: string;
    source?: string;
    license?: string;
    genre?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const musicTrackSchema = new Schema<IMusicTrack>(
  {
    trackId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    energyCategory: {
      type: String,
      enum: ["high", "mid", "low", "custom"],
      required: true,
    },
    s3FullTrackUrl: {
      type: String,
      required: true,
    },
    s3PreviewUrl: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    metadata: {
      artist: { type: String, trim: true },
      source: { type: String, trim: true },
      license: { type: String, trim: true },
      genre: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
musicTrackSchema.index({ energyCategory: 1 });
musicTrackSchema.index({ userId: 1 });
musicTrackSchema.index({ energyCategory: 1, userId: 1 });
// Note: trackId already has an index from unique: true

export default mongoose.models.MusicTrack ||
  mongoose.model<IMusicTrack>("MusicTrack", musicTrackSchema);
