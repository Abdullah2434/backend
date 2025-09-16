import mongoose, { Schema, Document } from 'mongoose';



export interface ITopic extends Document {
  topic: string;
  description: string;
  keypoints: string;
  createdAt: Date;
  updatedAt: Date;
}

const TopicSchema: Schema = new Schema({
  topic: {
    type: String,
    required: true,
    enum: ['real_estate']
  },
  description: { type: String, required: true },
  keypoints: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});



export default mongoose.models.Topic || mongoose.model<ITopic>('Topic', TopicSchema);
