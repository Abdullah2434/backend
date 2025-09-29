import mongoose, { Document, Schema } from 'mongoose';

export interface ISocialBuMedia extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  mime_type: string;
  
  // SocialBu API Response Data
  socialbuResponse: {
    name: string;
    mime_type: string;
    signed_url: string;
    key: string;
    secure_key: string;
    url: string;
  };
  
  // Upload Script Execution Data
  uploadScript: {
    videoUrl: string;
    executed: boolean;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    duration?: number; // in milliseconds
    response?: {
      statusCode: number;
      headers: any;
      success: boolean;
      finalVideoUrl?: string;
      errorMessage?: string;
    };
  };
  
  // Overall Status
  status: 'pending' | 'api_completed' | 'script_executing' | 'script_completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  markApiCompleted(): Promise<ISocialBuMedia>;
  markScriptExecuting(): Promise<ISocialBuMedia>;
  markScriptCompleted(response: any): Promise<ISocialBuMedia>;
  markScriptFailed(error: string): Promise<ISocialBuMedia>;
  markAsFailed(error: string): Promise<ISocialBuMedia>;
}

export interface ISocialBuMediaModel extends mongoose.Model<ISocialBuMedia> {
  findByUserId(userId: string): Promise<ISocialBuMedia[]>;
  findActiveUploads(): Promise<ISocialBuMedia[]>;
}

const socialBuMediaSchema = new Schema<ISocialBuMedia>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  mime_type: {
    type: String,
    required: true
  },
  
  // SocialBu API Response Data
  socialbuResponse: {
    name: { type: String, required: true },
    mime_type: { type: String, required: true },
    signed_url: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    secure_key: { type: String, required: true },
    url: { type: String, required: true }
  },
  
  // Upload Script Execution Data
  uploadScript: {
    videoUrl: { type: String, required: true },
    executed: { type: Boolean, default: false },
    status: { 
      type: String, 
      enum: ['pending', 'executing', 'completed', 'failed'], 
      default: 'pending' 
    },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number }, // in milliseconds
    response: {
      statusCode: { type: Number },
      headers: { type: Schema.Types.Mixed },
      success: { type: Boolean },
      finalVideoUrl: { type: String },
      errorMessage: { type: String }
    }
  },
  
  // Overall Status
  status: {
    type: String,
    enum: ['pending', 'api_completed', 'script_executing', 'script_completed', 'failed'],
    default: 'pending',
    index: true
  },
  errorMessage: {
    type: String
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Instance methods
socialBuMediaSchema.methods.markApiCompleted = function(this: ISocialBuMedia): Promise<ISocialBuMedia> {
  this.status = 'api_completed';
  return this.save();
};

socialBuMediaSchema.methods.markScriptExecuting = function(this: ISocialBuMedia): Promise<ISocialBuMedia> {
  this.status = 'script_executing';
  this.uploadScript.status = 'executing';
  this.uploadScript.startTime = new Date();
  return this.save();
};

socialBuMediaSchema.methods.markScriptCompleted = function(this: ISocialBuMedia, response: any): Promise<ISocialBuMedia> {
  this.status = 'script_completed';
  this.uploadScript.status = 'completed';
  this.uploadScript.executed = true;
  this.uploadScript.endTime = new Date();
  this.uploadScript.duration = this.uploadScript.startTime ? 
    this.uploadScript.endTime.getTime() - this.uploadScript.startTime.getTime() : 0;
  this.uploadScript.response = response;
  return this.save();
};

socialBuMediaSchema.methods.markScriptFailed = function(this: ISocialBuMedia, error: string): Promise<ISocialBuMedia> {
  this.status = 'failed';
  this.uploadScript.status = 'failed';
  this.uploadScript.endTime = new Date();
  this.uploadScript.duration = this.uploadScript.startTime ? 
    this.uploadScript.endTime.getTime() - this.uploadScript.startTime.getTime() : 0;
  this.uploadScript.response = {
    statusCode: 500,
    headers: {},
    success: false,
    errorMessage: error
  };
  this.errorMessage = error;
  return this.save();
};

socialBuMediaSchema.methods.markAsFailed = function(this: ISocialBuMedia, error: string): Promise<ISocialBuMedia> {
  this.status = 'failed';
  this.errorMessage = error;
  return this.save();
};

// Static methods
socialBuMediaSchema.statics.findByUserId = function(userId: string): Promise<ISocialBuMedia[]> {
  return this.find({ userId }).sort({ createdAt: -1 });
};

socialBuMediaSchema.statics.findActiveUploads = function(): Promise<ISocialBuMedia[]> {
  return this.find({ status: 'uploading' });
};

// Indexes
socialBuMediaSchema.index({ userId: 1, status: 1 });
socialBuMediaSchema.index({ 'socialbuResponse.key': 1 }, { unique: true });
socialBuMediaSchema.index({ createdAt: -1 });

export default mongoose.models.SocialBuMedia || mongoose.model<ISocialBuMedia, ISocialBuMediaModel>('SocialBuMedia', socialBuMediaSchema);
