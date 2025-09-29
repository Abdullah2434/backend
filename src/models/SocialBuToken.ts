import mongoose, { Document, Schema } from 'mongoose';

export interface ISocialBuToken extends Document {
  authToken: string;
  id: number;
  name: string;
  email: string;
  verified: boolean;
  isActive: boolean;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  markAsUsed(): Promise<ISocialBuToken>;
  isExpired: boolean;
}

export interface ISocialBuTokenModel extends mongoose.Model<ISocialBuToken> {
  findActiveToken(): Promise<ISocialBuToken | null>;
  deactivateAllTokens(): Promise<any>;
}

const SocialBuTokenSchema = new Schema<ISocialBuToken>({
  authToken: {
    type: String,
    required: true,
    unique: true
  },
  id: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
SocialBuTokenSchema.index({ isActive: 1 });
SocialBuTokenSchema.index({ email: 1 });

// Virtual for checking if token is expired (assuming 1 year expiry)
SocialBuTokenSchema.virtual('isExpired').get(function(this: ISocialBuToken) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return this.lastUsed < oneYearAgo;
});

// Instance methods
SocialBuTokenSchema.methods.markAsUsed = function(this: ISocialBuToken) {
  this.lastUsed = new Date();
  return this.save();
};

// Static methods
SocialBuTokenSchema.statics.findActiveToken = function() {
  return this.findOne({ isActive: true }).sort({ createdAt: -1 });
};

SocialBuTokenSchema.statics.deactivateAllTokens = function() {
  return this.updateMany({ isActive: true }, { isActive: false });
};

export default mongoose.model<ISocialBuToken, ISocialBuTokenModel>('SocialBuToken', SocialBuTokenSchema);
