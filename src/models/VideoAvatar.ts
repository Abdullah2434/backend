import mongoose, { Document, Schema } from 'mongoose';

export interface IVideoAvatar extends Document {
  avatar_id: string;
  avatar_group_id: string;
  avatar_name: string;
  training_footage_url: string;
  consent_statement_url: string;
  status: 'in_progress' | 'completed' | 'failed';
  callback_id?: string;
  callback_url?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const VideoAvatarSchema = new Schema<IVideoAvatar>({
  avatar_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  avatar_group_id: {
    type: String,
    required: true,
    index: true
  },
  avatar_name: {
    type: String,
    required: true
  },
  training_footage_url: {
    type: String,
    required: true
  },
  consent_statement_url: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'failed'],
    default: 'in_progress',
    required: true
  },
  callback_id: {
    type: String,
    required: false
  },
  callback_url: {
    type: String,
    required: false
  },
  error: {
    type: String,
    required: false
  },
  completedAt: {
    type: Date,
    required: false
  }
}, {
  timestamps: true,
  collection: 'video_avatars'
});

// Indexes for better query performance
VideoAvatarSchema.index({ avatar_id: 1 });
VideoAvatarSchema.index({ avatar_group_id: 1 });
VideoAvatarSchema.index({ status: 1 });
VideoAvatarSchema.index({ createdAt: -1 });

export default mongoose.model<IVideoAvatar>('VideoAvatar', VideoAvatarSchema);
