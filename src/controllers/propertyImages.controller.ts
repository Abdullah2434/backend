import { Request, Response } from "express";
import multer from "multer";
import axios from "axios";
import { getS3 } from "../services/s3.service";
import DefaultAvatar from "../models/avatar";
import User from "../models/User";
import PendingCaptions from "../models/PendingCaptions";
import {
  ESTIMATED_COMPLETION_MINUTES,
  SOCIAL_MEDIA_PLATFORMS,
} from "../constants/video.constants";
import { sendFireAndForgetWebhook } from "../utils/videoControllerHelpers";
import { CaptionGenerationService } from "../services/content/captionGeneration.service";
import { truncateSocialMediaCaptions } from "../utils/captionTruncationHelpers";
import {
  propertyImagesSchema,
  PropertyImagesPayload,
  propertyWebhookSchema,
  PropertyWebhookPayload,
} from "../validations/propertyImages.validations";

// Store uploaded images in memory; we immediately stream to S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 20 * 1024 * 1024, // 20MB per image
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Bucket explicitly requested by user
const PROPERTY_IMAGE_BUCKET = "voice-elven-lab-audio";
const WEBHOOK_URL =
  "https://edgeaimedia.app.n8n.cloud/webhook/cca3a948-947c-4532-bd8b-3d7d0c3cf97a";
const PROPERTY_WEBHOOK_URL =
  "https://edgeaimedia.app.n8n.cloud/webhook/438c63f4-902b-40c5-b954-552370924e51";

/**
 * Normalize incoming types (string JSON, comma-separated, or array) to array
 */
function normalizeTypes(
  types: any,
  expectedLength?: number
): string[] | undefined {
  if (types === undefined || types === null) return undefined;

  // Already an array
  if (Array.isArray(types)) {
    return types.map((t) => String(t || "").trim());
  }

  if (typeof types === "string") {
    // Try JSON array string
    try {
      const parsed = JSON.parse(types);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => String(t || "").trim());
      }
    } catch {
      // Fallback: comma-separated
      const parts = types.split(",").map((p) => p.trim());
      if (parts.length) return parts;
    }
  }

  throw new Error(
    "Unable to parse types. Provide JSON array or comma-separated string."
  );
}

function buildS3Key(type: string, originalName: string): string {
  const safeType = type.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_").toLowerCase();
  return `property-images/${safeType}/${Date.now()}_${safeName}`;
}

function extractTypes(
  data: PropertyImagesPayload,
  files: Express.Multer.File[],
  body: any
): string[] {
  // Primary: types array from payload
  if (Array.isArray(data.types) && data.types.length === files.length) {
    return data.types;
  }

  // Secondary: types provided as JSON array in `types` field
  if (body?.types && typeof body.types === "string") {
    try {
      const parsed = JSON.parse(body.types);
      if (Array.isArray(parsed) && parsed.length === files.length) {
        return parsed.map((v: any) => String(v || ""));
      }
    } catch {
      // ignore parse error, fall through
    }
  }

  // Tertiary: types provided as comma-separated string in `types`
  if (body?.types && typeof body.types === "string") {
    const parts = body.types.split(",").map((p: string) => p.trim());
    if (parts.length === files.length) return parts;
  }

  throw new Error(
    "Types metadata is missing or does not match number of uploaded files"
  );
}

export const uploadPropertyImagesMiddleware = upload.array("images", 20);

export async function uploadPropertyImages(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const files = (req.files || []) as Express.Multer.File[];
    // Normalize types before validation so string inputs pass schema
    let normalizedTypes: string[] | undefined;
    try {
      normalizedTypes = normalizeTypes(req.body.types, files.length);
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err?.message || "Invalid types format",
      });
    }

    const payload = {
      ...req.body,
      ...(normalizedTypes ? { types: normalizedTypes } : {}),
    } as PropertyImagesPayload;

    const parsed = propertyImagesSchema.safeParse(payload);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "At least one image file is required",
      });
    }

    const s3 = getS3();

    // Resolve types aligned with files (supports payload types array or string)
    const types = extractTypes(data, files, req.body);

    const uploads = await Promise.all(
      files.map(async (file, idx) => {
        const type = types[idx];
        const Key = buildS3Key(type, file.originalname || `image-${idx}`);

        // upload to specified bucket
        const url = await s3.uploadBuffer({
          Key,
          Body: file.buffer,
          ContentType: file.mimetype || "image/jpeg",
          Bucket: PROPERTY_IMAGE_BUCKET,
        });

        return {
          type,
          s3Key: Key,
          imageUrl: url,
        };
      })
    );

    // Call webhook with the uploaded URLs (field name `imageurl` as requested)
    // Wait for webhook response before returning
    let webhookResponse: any = null;
    try {
      const timestamp = data.timestamp || new Date().toISOString();
      const webhookPayload = {
        ...data,
        timestamp,
        price: data.price,
        city: data.city,
        address: data.address,
        mainSellingPoints: data.mainSellingPoints,
        images: uploads.map((u) => ({
          type: u.type,
          imageurl: u.imageUrl,
        })),
      };

      // Wait for webhook response with longer timeout
      const resp = await axios.post(WEBHOOK_URL, webhookPayload, {
        headers: { "Content-Type": "application/json" },
        timeout: 120000, // 120 seconds timeout - wait for webhook response
      });
      webhookResponse = resp.data;
      console.log("Webhook response received:", resp.status);
    } catch (err: any) {
      console.error("Webhook call failed:", err?.message || err);
      webhookResponse = {
        error: true,
        message: err?.response?.data || err?.message || "Webhook call failed",
      };
    }

    return res.json({
      success: true,
      message: "Images uploaded successfully",
      data: {
        email: data.email,
        timestamp: data.timestamp || new Date().toISOString(),
        name: data.name,
        social_handles: data.social_handles,
        propertyType: data.propertyType,
        price: data.price,
        city: data.city,
        address: data.address,
        mainSellingPoints: data.mainSellingPoints,
        images: uploads,
        webhookResponse,
      },
    });
  } catch (error: any) {
    console.error("Failed to upload property images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload images",
      error: error?.message || "Unknown error",
    });
  }
}

/**
 * Convert object with numeric keys to array
 * Handles cases like {"0": {...}, "1": {...}} -> [{...}, {...}]
 */
function objectToArray(obj: any): any[] {
  if (Array.isArray(obj)) return obj;
  if (typeof obj !== "object" || obj === null) return [];

  // Check if it's an object with numeric keys (like {"0": {...}, "1": {...}})
  const keys = Object.keys(obj);
  const numericKeys = keys.filter((k) => /^\d+$/.test(k));

  if (numericKeys.length > 0) {
    // Convert to array by sorting numeric keys and mapping values
    return numericKeys
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((key) => obj[key]);
  }

  // If it's a regular object, wrap it in an array
  return [obj];
}

/**
 * Normalize arrays in request body (handle JSON strings and objects)
 */
function normalizeArrays(body: any): any {
  const normalized = { ...body };

  // Normalize images array
  if (normalized.images !== undefined) {
    if (typeof normalized.images === "string") {
      try {
        normalized.images = JSON.parse(normalized.images);
      } catch {
        normalized.images = [];
      }
    }
    // Convert object with numeric keys or single object to array
    if (
      normalized.images &&
      typeof normalized.images === "object" &&
      !Array.isArray(normalized.images)
    ) {
      normalized.images = objectToArray(normalized.images);
    }
    // Ensure it's an array
    if (!Array.isArray(normalized.images)) {
      normalized.images = [];
    }
  }

  // Normalize webhookResponse array
  if (normalized.webhookResponse !== undefined) {
    if (typeof normalized.webhookResponse === "string") {
      try {
        normalized.webhookResponse = JSON.parse(normalized.webhookResponse);
      } catch {
        normalized.webhookResponse = [];
      }
    }
    // Convert object with numeric keys or single object to array
    if (
      normalized.webhookResponse &&
      typeof normalized.webhookResponse === "object" &&
      !Array.isArray(normalized.webhookResponse)
    ) {
      normalized.webhookResponse = objectToArray(normalized.webhookResponse);
    }
    // Ensure it's an array if provided
    if (
      normalized.webhookResponse &&
      !Array.isArray(normalized.webhookResponse)
    ) {
      normalized.webhookResponse = [];
    }
  }

  return normalized;
}

/**
 * Forward property data to webhook
 * POST /api/property-webhook
 */
export async function forwardPropertyWebhook(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Normalize arrays before validation
    const normalizedBody = normalizeArrays(req.body);

    // Validate request body
    const parsed = propertyWebhookSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      console.error("Validation errors:", parsed.error.flatten());
      console.error("Received body:", JSON.stringify(req.body, null, 2));
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    // Look up avatarType from database if not provided
    let avatarType = data.avatarType;
    if (!avatarType && data.avatar) {
      try {
        const avatar = await DefaultAvatar.findOne({ avatar_id: data.avatar });
        if (avatar && (avatar as any).avatarType) {
          avatarType = (avatar as any).avatarType;
        } else {
          return res.status(404).json({
            success: false,
            message: `Avatar not found with ID: ${data.avatar}`,
          });
        }
      } catch (err: any) {
        console.error("Error looking up avatar:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to look up avatar",
          error: err?.message || "Unknown error",
        });
      }
    }

    if (!avatarType) {
      return res.status(400).json({
        success: false,
        message:
          "avatarType is required. Either provide it in the request or ensure the avatar exists in the database.",
      });
    }

    // Prepare payload with timestamp if not provided
    const payload: PropertyWebhookPayload & {
      avatarType: string;
      videoType: string;
    } = {
      ...data,
      avatarType,
      videoType: data.videoType || "VideoListing",
      timestamp: data.timestamp || new Date().toISOString(),
    };

    // Forward to webhook asynchronously (fire and forget)
    sendFireAndForgetWebhook(PROPERTY_WEBHOOK_URL, payload);

    // Generate captions in background using webhookResponse texts
    (async () => {
      try {
        // Extract texts from webhookResponse array
        const webhookTexts =
          data.webhookResponse
            ?.map((item: { text: string }) => item.text)
            .filter((text: string) => text && text.trim())
            .join(" ") || "";

        if (webhookTexts) {
          // Get user for userContext
          const user = await User.findOne({ email: data.email });
          const userContext = {
            name: data.name || "",
            position: "",
            companyName: "",
            city: "",
            socialHandles: data.social_handles || "",
          };

          // Generate 6 different platform-specific captions using OpenAI
          // OpenAI will summarize/create unique captions based on webhookResponse texts
          const captions = await CaptionGenerationService.generateCaptions(
            data.title || "Property Listing Video", // Topic
            webhookTexts, // Key Points (all webhookResponse texts combined)
            userContext,
            undefined // language will be determined from user settings if available
          );

          // Truncate captions to platform limits
          const truncatedCaptions = truncateSocialMediaCaptions(captions);

          // Verify all 6 captions were generated
          const captionCount = Object.keys(truncatedCaptions).filter(
            (key) => truncatedCaptions[key as keyof typeof truncatedCaptions]
          ).length;

          // Store captions in PendingCaptions for later attachment to video
          await PendingCaptions.findOneAndUpdate(
            { email: data.email, title: data.title },
            {
              email: data.email,
              title: data.title,
              captions: truncatedCaptions,
              topic: data.title || "Property Listing Video",
              keyPoints: webhookTexts,
              userContext,
              userId: user?._id?.toString(),
              platforms: [...SOCIAL_MEDIA_PLATFORMS],
              isDynamic: false,
              isPending: false, // Captions are ready, just waiting for video
            },
            { upsert: true, new: true }
          );

          console.log(
            `✅ Generated ${captionCount} unique platform captions for property video: ${data.title} (${data.email})`
          );
          console.log(
            `   Platforms: Instagram, Facebook, LinkedIn, Twitter, TikTok, YouTube`
          );
        }
      } catch (captionError: any) {
        // Silently fail - captions are optional
        console.error(
          "Failed to generate captions for property webhook:",
          captionError?.message || captionError
        );
      }
    })();

    // Return immediately without waiting for webhook response
    return res.json({
      success: true,
      message: "Your video is in progress",
      data: {
        status: "processing",
        timestamp: new Date().toISOString(),
        estimated_completion: new Date(
          Date.now() + ESTIMATED_COMPLETION_MINUTES * 60 * 1000
        ).toISOString(),
        note: "Video generation is running in the background. The video will be available when ready.",
      },
    });
  } catch (error: any) {
    console.error("Failed to forward property webhook:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to forward data to webhook",
      error: error?.message || "Unknown error",
    });
  }
}
