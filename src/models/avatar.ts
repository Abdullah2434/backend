import mongoose, { Schema, Document } from 'mongoose';

export type AvatarStatus = 'pending' | 'training' | 'ready' | 'processing' | 'completed' | 'failed';

export interface IDefaultAvatar extends Document {
  avatar_id: string;
  avatar_name: string;
  gender?: string;
  preview_image_url?: string;
  preview_video_url?: string;
  default: boolean;
  userId?: mongoose.Types.ObjectId;
  ethnicity?: string;
  age_group?: string;
  status?: AvatarStatus;
  avatar_group_id?: string;
  error?: string;
  completedAt?: Date;
  default_voice_id?: string;
  callback_id?: string;
  callback_url?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DefaultAvatarSchema: Schema = new Schema({
  avatar_id: { type: String, required: true, unique: true },
  avatar_name: { type: String, required: true },
  gender: { type: String, required: false },
  preview_image_url: { type: String, required: false },
  preview_video_url: { type: String, required: false },
  default: { type: Boolean, default: true },
  ethnicity: { type: String, required: false },
  age_group: { type: String, required: false },
  status: {
    type: String,
    enum: ['pending', 'training', 'ready', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  avatar_group_id: { type: String, required: false },
  error: { type: String, required: false },
  completedAt: { type: Date, required: false },
  default_voice_id: { type: String, required: false },
  callback_id: { type: String, required: false },
  callback_url: { type: String, required: false },
  userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
}, {
  timestamps: true
});

export default mongoose.model<IDefaultAvatar>('DefaultAvatar', DefaultAvatarSchema);