import mongoose, { Schema, Document } from "mongoose";

export interface IContentTemplate extends Document {
  platform:
    | "instagram"
    | "facebook"
    | "linkedin"
    | "twitter"
    | "tiktok"
    | "youtube";
  variant: number; // 1-5 for each platform
  name: string;
  description: string;
  structure: {
    hook: {
      type: "question" | "bold_statement" | "story" | "data" | "provocative";
      template: string;
      examples: string[];
    };
    description: {
      template: string;
      maxLength: number;
    };
    keyPoints: {
      template: string;
      maxPoints: number;
    };
    conclusion: {
      ctaType:
        | "question"
        | "collaborative"
        | "action"
        | "share"
        | "provocative";
      template: string;
      examples: string[];
    };
  };
  tone:
    | "casual"
    | "professional"
    | "educational"
    | "energetic"
    | "storytelling"
    | "analytical"
    | "provocative"
    | "relatable"
    | "ultra_casual"
    | "edgy"
    | "entertaining"
    | "authentic"
    | "friendly"
    | "community_focused"
    | "helpful"
    | "conversational"
    | "consultative";
  platformOptimizations: {
    maxLength: number;
    hashtagCount: number;
    emojiUsage: "minimal" | "moderate" | "heavy";
    lineBreaks: boolean;
    callToAction: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contentTemplateSchema = new Schema<IContentTemplate>(
  {
    platform: {
      type: String,
      required: true,
      enum: [
        "instagram",
        "facebook",
        "linkedin",
        "twitter",
        "tiktok",
        "youtube",
      ],
    },
    variant: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    structure: {
      hook: {
        type: {
          type: String,
          required: true,
          enum: ["question", "bold_statement", "story", "data", "provocative"],
        },
        template: {
          type: String,
          required: true,
        },
        examples: [String],
      },
      description: {
        template: {
          type: String,
          required: true,
        },
        maxLength: {
          type: Number,
          required: true,
        },
      },
      keyPoints: {
        template: {
          type: String,
          required: true,
        },
        maxPoints: {
          type: Number,
          required: true,
        },
      },
      conclusion: {
        ctaType: {
          type: String,
          required: true,
          enum: ["question", "collaborative", "action", "share", "provocative"],
        },
        template: {
          type: String,
          required: true,
        },
        examples: [String],
      },
    },
    tone: {
      type: String,
      required: true,
      enum: [
        "casual",
        "professional",
        "educational",
        "energetic",
        "storytelling",
        "analytical",
        "provocative",
        "relatable",
        "ultra_casual",
        "edgy",
        "entertaining",
        "authentic",
        "friendly",
        "community_focused",
        "helpful",
        "conversational",
        "consultative",
      ],
    },
    platformOptimizations: {
      maxLength: {
        type: Number,
        required: true,
      },
      hashtagCount: {
        type: Number,
        required: true,
      },
      emojiUsage: {
        type: String,
        required: true,
        enum: ["minimal", "moderate", "heavy"],
      },
      lineBreaks: {
        type: Boolean,
        required: true,
      },
      callToAction: {
        type: String,
        required: true,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
    id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create unique compound index for platform + variant
contentTemplateSchema.index({ platform: 1, variant: 1 }, { unique: true });

export default mongoose.models.ContentTemplate ||
  mongoose.model<IContentTemplate>("ContentTemplate", contentTemplateSchema);
