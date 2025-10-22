import mongoose, { Document, Schema } from 'mongoose';

export interface IVideoAvatar extends Document {
  userId?: mongoose.Types.ObjectId;
  avatar_id: string;
  avatar_group_id: string;
  avatar_name: string;
  training_footage_url: string;
  consent_statement_url: string;
  status: 'processing' | 'completed' | 'failed';
  callback_id?: string;
  callback_url?: string;
  error?: string;
  error_message?: string;
  preview_image_url?: string;
  preview_video_url?: string;
  default_voice_id?: string;
  heygen_response?: any;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const VideoAvatarSchema = new Schema<IVideoAvatar>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
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
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
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
  error_message: {
    type: String,
    required: false
  },
  preview_image_url: {
    type: String,
    required: false
  },
  preview_video_url: {
    type: String,
    required: false
  },
  default_voice_id: {
    type: String,
    required: false
  },
  heygen_response: {
    type: Schema.Types.Mixed,
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
VideoAvatarSchema.index({ userId: 1 });
VideoAvatarSchema.index({ status: 1 });
VideoAvatarSchema.index({ createdAt: -1 });

export default mongoose.model<IVideoAvatar>('VideoAvatar', VideoAvatarSchema);
