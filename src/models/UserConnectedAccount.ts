import mongoose, { Schema, Document } from 'mongoose'

export interface IUserConnectedAccount extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  socialbuAccountId: number
  accountName: string
  accountType: string
  accountTypeDisplay: string
  accountId: string
  publicId: string
  isActive: boolean
  image?: string
  postMaxlength: number
  attachmentTypes: string[]
  maxAttachments: number
  postMediaRequired: boolean
  videoDimensions: {
    min: [number, number | null]
    max: [number | null, number | null]
  }
  videoDuration: {
    min: number
    max: number
  }
  extraData?: any
  connectedAt: Date
  lastUsedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const userConnectedAccountSchema = new Schema<IUserConnectedAccount>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  socialbuAccountId: { 
    type: Number, 
    required: true, 
    index: true 
  },
  accountName: { 
    type: String, 
    required: true, 
    trim: true 
  },
  accountType: { 
    type: String, 
    required: true, 
    trim: true 
  },
  accountTypeDisplay: { 
    type: String, 
    required: true, 
    trim: true 
  },
  accountId: { 
    type: String, 
    required: true, 
    trim: true 
  },
  publicId: { 
    type: String, 
    required: true, 
    trim: true 
  },
  isActive: { 
    type: Boolean, 
    default: true, 
    index: true 
  },
  image: { 
    type: String, 
    trim: true 
  },
  postMaxlength: { 
    type: Number, 
    required: true 
  },
  attachmentTypes: [{ 
    type: String, 
    trim: true 
  }],
  maxAttachments: { 
    type: Number, 
    required: true 
  },
  postMediaRequired: { 
    type: Boolean, 
    default: false 
  },
  videoDimensions: {
    min: {
      type: [Schema.Types.Mixed],
      required: true
    },
    max: {
      type: [Schema.Types.Mixed],
      required: true
    }
  },
  videoDuration: {
    min: { 
      type: Number, 
      required: true 
    },
    max: { 
      type: Number, 
      required: true 
    }
  },
  extraData: { 
    type: Schema.Types.Mixed, 
    default: {} 
  },
  connectedAt: { 
    type: Date, 
    default: Date.now 
  },
  lastUsedAt: { 
    type: Date 
  }
}, { 
  timestamps: true, 
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true } 
})

// Create compound indexes for better query performance
userConnectedAccountSchema.index({ userId: 1, socialbuAccountId: 1 }, { unique: true })
userConnectedAccountSchema.index({ userId: 1, isActive: 1 })
userConnectedAccountSchema.index({ socialbuAccountId: 1, isActive: 1 })
userConnectedAccountSchema.index({ accountType: 1, isActive: 1 })

export default mongoose.models.UserConnectedAccount || mongoose.model<IUserConnectedAccount>('UserConnectedAccount', userConnectedAccountSchema)
