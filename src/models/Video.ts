import mongoose, { Schema, Document } from 'mongoose'
import { VideoMetadata } from '../types'

export interface IVideo extends Document {
  _id: mongoose.Types.ObjectId
  videoId: string
  userId?: mongoose.Types.ObjectId
  email: string
  title: string
  secretKey: string
  s3Key: string
  videoUrl: string
  status: 'processing' | 'ready' | 'failed'
  metadata?: VideoMetadata
  createdAt: Date
  updatedAt: Date
}

const videoSchema = new Schema<IVideo>({
  videoId: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  email: { type: String, required: true, index: true, trim: true },
  title: { type: String, required: true, trim: true },
  videoUrl: { type: String, required: true },
  secretKey: { type: String, required: true, select: false },
  s3Key: { type: String, required: true },
  status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing', index: true },
  metadata: { duration: Number, size: Number, format: String },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })

videoSchema.index({ userId: 1, createdAt: -1 })
videoSchema.index({ email: 1, createdAt: -1 })
videoSchema.index({ status: 1, createdAt: -1 })
videoSchema.index({ s3Key: 1 })

export default mongoose.models.Video || mongoose.model<IVideo>('Video', videoSchema)


