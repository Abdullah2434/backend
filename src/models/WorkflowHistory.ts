import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkflowHistory extends Document {
  executionId: string;
  userId: mongoose.Types.ObjectId;
  email: string;
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
  }
}, {
  timestamps: true
});

export default mongoose.model<IWorkflowHistory>('WorkflowHistory', WorkflowHistorySchema);
