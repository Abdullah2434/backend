import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkflowHistory extends Document {
  executionId: string;
  userId: mongoose.Types.ObjectId;
  email: string;
  status: 'pending' | 'completed' | 'failed';
  completedAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowHistorySchema = new Schema<IWorkflowHistory>({
  executionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    required: true,
    index: true
  },
  completedAt: {
    type: Date,
    index: true
  },
  failedAt: {
    type: Date,
    index: true
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Create compound index for efficient queries (status + createdAt)
WorkflowHistorySchema.index({ status: 1, createdAt: 1 });

export default mongoose.model<IWorkflowHistory>('WorkflowHistory', WorkflowHistorySchema);
