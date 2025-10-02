import mongoose, { Schema, Document } from 'mongoose';

export interface IDefaultVoice extends Document {
  voice_id: string;
  language: string;
  gender: string;
  name: string;
  preview_audio: string;
  default: boolean;
  userId?: mongoose.Types.ObjectId;

}

const DefaultVoiceSchema: Schema = new Schema({
  voice_id: { type: String, required: true, unique: true },
  language: { type: String, required: true },
  gender: { type: String, required: true },
  name: { type: String, required: false },
  preview_audio: { type: String, required: false },
  default: { type: Boolean, default: true },
  userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
});

export default mongoose.model<IDefaultVoice>('DefaultVoice', DefaultVoiceSchema);