import mongoose, { Schema, Document } from 'mongoose';

export type AvatarStatus = 'pending' | 'training' | 'ready';

export interface IDefaultAvatar extends Document {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url: string;
  preview_video_url: string;
  default: boolean;
  userId?: mongoose.Types.ObjectId;
  ethnicity?: string;
  age_group?: string;
  status?: AvatarStatus;
}

const DefaultAvatarSchema: Schema = new Schema({
  avatar_id: { type: String, required: true, unique: true },
  avatar_name: { type: String, required: true },
  gender: { type: String, required: true },
  preview_image_url: { type: String, required: false },
  preview_video_url: { type: String, required: false },
  default: { type: Boolean, default: true },
  ethnicity: { type: String, required: false },
  age_group: { type: String, required: false },
  status: {
    type: String,
    enum: ['pending', 'training', 'ready'],
    default: 'pending',
  },
  userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
});

export default mongoose.model<IDefaultAvatar>('DefaultAvatar', DefaultAvatarSchema);