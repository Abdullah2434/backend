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
import {
  sendFireAndForgetWebhook,
  checkVideoCreationLimit,
} from "../utils/videoControllerHelpers";
import { CaptionGenerationService } from "../services/content/captionGeneration.service";
import { truncateSocialMediaCaptions } from "../utils/captionTruncationHelpers";
import { VideoService } from "../services/video";
import {
  propertyImagesSchema,
  PropertyImagesPayload,
  propertyWebhookSchema,
  PropertyWebhookPayload,
  tourVideoSchema,
  TourVideoPayload,
  narratedVideoSchema,
  NarratedVideoPayload,
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
const TOUR_VIDEO_WEBHOOK_URL =
  "https://edgeaimedia.app.n8n.cloud/webhook/tour-video";
const NARRATED_VIDEO_WEBHOOK_URL =
  "https://edgeaimedia.app.n8n.cloud/webhook/narrattied-video";

// Service instance
const videoService = new VideoService();

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

// Multer configuration for tour video (startImage + restImages)
const tourVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 21, // 1 startImage + up to 20 restImages
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

export const uploadTourVideoMiddleware = tourVideoUpload.fields([
  { name: "startImage", maxCount: 1 },
  { name: "restImages", maxCount: 20 },
]);

export async function uploadPropertyImages(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // ⚠️ CRITICAL: Check video limit FIRST before any processing or webhook calls
    const email = String(req.body.email || "").trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to check subscription limits",
      });
    }

    const user = await videoService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const videoLimit = await checkVideoCreationLimit(email, videoService);

    if (!videoLimit.canCreate) {
      return res.status(429).json({
        success: false,
        message: `Video limit reached. You have used ${
          videoLimit.used || 0
        } out of ${
          videoLimit.limit || 0
        } videos this month. Your subscription will renew monthly.`,
        data: {
          limit: videoLimit.limit,
          remaining: videoLimit.remaining,
          used: videoLimit.used,
        },
      });
    }

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
        size: data.size,
        bedroomCount: data.bedroomCount,
        bathroomCount: data.bathroomCount,
        lotSize: data.lotSize,
        preferredTone: data.preferredTone,
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
        size: data.size,
        bedroomCount: data.bedroomCount,
        bathroomCount: data.bathroomCount,
        lotSize: data.lotSize,
        preferredTone: data.preferredTone,
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
    // ⚠️ CRITICAL: Check video limit FIRST before any processing or webhook calls
    const email = String(req.body.email || "").trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to check subscription limits",
      });
    }

    const user = await videoService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const videoLimit = await checkVideoCreationLimit(email, videoService);

    if (!videoLimit.canCreate) {
      return res.status(429).json({
        success: false,
        message: `Video limit reached. You have used ${
          videoLimit.used || 0
        } out of ${
          videoLimit.limit || 0
        } videos this month. Your subscription will renew monthly.`,
        data: {
          limit: videoLimit.limit,
          remaining: videoLimit.remaining,
          used: videoLimit.used,
        },
      });
    }

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
      useMusic?: boolean | string;
    } = {
      ...data,
      avatarType,
      videoType: data.videoType || "VideoListing",
      timestamp: data.timestamp || new Date().toISOString(),
      useMusic: data.useMusic,
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
      message: "Listing video creating successfully",
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

/**
 * Upload tour video images and forward to webhook
 * POST /api/tour-video
 */
export async function uploadTourVideo(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // ⚠️ CRITICAL: Check video limit FIRST before any processing or webhook calls
    const email = String(req.body.email || "").trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to check subscription limits",
      });
    }

    const user = await videoService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const videoLimit = await checkVideoCreationLimit(email, videoService);

    if (!videoLimit.canCreate) {
      return res.status(429).json({
        success: false,
        message: `Video limit reached. You have used ${
          videoLimit.used || 0
        } out of ${
          videoLimit.limit || 0
        } videos this month. Your subscription will renew monthly.`,
        data: {
          limit: videoLimit.limit,
          remaining: videoLimit.remaining,
          used: videoLimit.used,
        },
      });
    }

    // Extract files from multer fields
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const startImageFiles = files?.startImage || [];
    const restImageFiles = files?.restImages || [];

    // Validate that we have at least startImage
    if (startImageFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "startImage is required",
      });
    }

    // Validate request body
    const parsed = tourVideoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
    }

    const data = parsed.data;
    const s3 = getS3();

    // Helper function to normalize filename while preserving original extension
    const normalizeFilename = (
      filename: string | undefined,
      defaultName: string
    ): string => {
      if (!filename) return `${defaultName}.jpg`;
      // Replace special chars but preserve extension
      return filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    };

    // Upload startImage first
    const startImageFile = startImageFiles[0];
    const startImageKey = `tour-video/${Date.now()}_start_${normalizeFilename(
      startImageFile.originalname,
      "start"
    )}`;
    const startImageUrl = await s3.uploadBuffer({
      Key: startImageKey,
      Body: startImageFile.buffer,
      ContentType: startImageFile.mimetype || "image/jpeg",
      Bucket: PROPERTY_IMAGE_BUCKET,
    });

    // Upload restImages
    const restImageUploads = await Promise.all(
      restImageFiles.map(async (file, idx) => {
        const key = `tour-video/${Date.now()}_${idx}_${normalizeFilename(
          file.originalname,
          `rest_${idx}`
        )}`;
        const url = await s3.uploadBuffer({
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "image/jpeg",
          Bucket: PROPERTY_IMAGE_BUCKET,
        });
        return { imageurl: url };
      })
    );

    // Combine images: startImage first, then restImages
    const allImages = [{ imageurl: startImageUrl }, ...restImageUploads];

    // Convert string fields to numbers
    const priceNumber = parseFloat(data.price) || 0;
    const bedRoomCountNumber = parseInt(data.bedRoomCount, 10) || 0;
    const bathRoomCountNumber = parseInt(data.bathRoomCount, 10) || 0;

    const webhookPayload = {
      images: allImages,
      email: data.email,
      timestamp: data.timestamp,
      name: data.name,
      social_handles: data.social_handles,
      propertyType: data.propertyType,
      music: data.music,
      title: data.title,
      city: data.city,
      address: data.address,
      price: priceNumber,
      size: data.size,
      bedRoomCount: bedRoomCountNumber,
      bathRoomCount: bathRoomCountNumber,
      ...(data.mainSellingPoints && data.mainSellingPoints.length > 0
        ? { mainSellingPoints: data.mainSellingPoints }
        : {}),
    };

    // Send to webhook (fire and forget)
    // Uses HTTPS POST with Content-Type: application/json
    // Body is JSON.stringify(webhookPayload)
    sendFireAndForgetWebhook(TOUR_VIDEO_WEBHOOK_URL, webhookPayload);

    // Generate captions in background using form data
    (async () => {
      try {
        // Build key points from form data
        const keyPointsArray: string[] = [];

        // Add property details
        if (data.propertyType) {
          keyPointsArray.push(`${data.propertyType}`);
        }
        if (priceNumber > 0) {
          keyPointsArray.push(`Price: $${priceNumber.toLocaleString()}`);
        }
        if (data.size) {
          keyPointsArray.push(`Size: ${data.size}`);
        }
        if (bedRoomCountNumber > 0) {
          keyPointsArray.push(
            `${bedRoomCountNumber} bedroom${bedRoomCountNumber > 1 ? "s" : ""}`
          );
        }
        if (bathRoomCountNumber > 0) {
          keyPointsArray.push(
            `${bathRoomCountNumber} bathroom${
              bathRoomCountNumber > 1 ? "s" : ""
            }`
          );
        }
        if (data.city) {
          keyPointsArray.push(`Located in ${data.city}`);
        }
        if (data.address) {
          keyPointsArray.push(`Address: ${data.address}`);
        }

        // Add main selling points if provided
        if (data.mainSellingPoints && data.mainSellingPoints.length > 0) {
          keyPointsArray.push(...data.mainSellingPoints);
        }

        const keyPoints = keyPointsArray.join(". ");

        if (keyPoints) {
          // Get user for userContext
          const user = await User.findOne({ email: data.email });
          const userContext = {
            name: data.name || "",
            position: "",
            companyName: "",
            city: data.city || "",
            socialHandles: data.social_handles || "",
          };

          // Generate 6 different platform-specific captions using OpenAI
          const captions = await CaptionGenerationService.generateCaptions(
            data.title || "Property Tour Video", // Topic
            keyPoints, // Key Points (form data combined)
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
              topic: data.title || "Property Tour Video",
              keyPoints: keyPoints,
              userContext,
              userId: user?._id?.toString(),
              platforms: [...SOCIAL_MEDIA_PLATFORMS],
              isDynamic: false,
              isPending: false, // Captions are ready, just waiting for video
            },
            { upsert: true, new: true }
          );

          console.log(
            `✅ Generated ${captionCount} unique platform captions for tour video: ${data.title} (${data.email})`
          );
          console.log(
            `   Platforms: Instagram, Facebook, LinkedIn, Twitter, TikTok, YouTube`
          );
        }
      } catch (captionError: any) {
        // Silently fail - captions are optional
        console.error(
          "Failed to generate captions for tour video:",
          captionError?.message || captionError
        );
      }
    })();

    return res.json({
      success: true,
      message: "Tour video images uploaded successfully",
      data: {
        email: data.email,
        timestamp: data.timestamp,
        name: data.name,
        social_handles: data.social_handles,
        propertyType: data.propertyType,
        title: data.title,
        city: data.city,
        address: data.address,
        price: priceNumber,
        size: data.size,
        bedRoomCount: bedRoomCountNumber,
        bathRoomCount: bathRoomCountNumber,
        music: data.music,
        ...(data.mainSellingPoints && data.mainSellingPoints.length > 0
          ? { mainSellingPoints: data.mainSellingPoints }
          : {}),
        images: allImages,
        note: "Video generation is running in the background. The video will be available when ready.",
      },
    });
  } catch (error: any) {
    console.error("Failed to upload tour video images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload tour video images",
      error: error?.message || "Unknown error",
    });
  }
}

/**
 * Create narrated video
 * POST /api/narrated-video
 */
export async function createNarratedVideo(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // ⚠️ CRITICAL: Check video limit FIRST before any processing or webhook calls
    const email = String(req.body.email || "").trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to check subscription limits",
      });
    }

    const user = await videoService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const videoLimit = await checkVideoCreationLimit(email, videoService);

    if (!videoLimit.canCreate) {
      return res.status(429).json({
        success: false,
        message: `Video limit reached. You have used ${
          videoLimit.used || 0
        } out of ${
          videoLimit.limit || 0
        } videos this month. Your subscription will renew monthly.`,
        data: {
          limit: videoLimit.limit,
          remaining: videoLimit.remaining,
          used: videoLimit.used,
        },
      });
    }

    // Normalize topicKeyPoints array before validation (handle JSON strings and objects)
    const normalizedBody = { ...req.body };
    if (normalizedBody.topicKeyPoints !== undefined) {
      // If it's a JSON string, parse it
      if (typeof normalizedBody.topicKeyPoints === "string") {
        try {
          normalizedBody.topicKeyPoints = JSON.parse(normalizedBody.topicKeyPoints);
        } catch {
          // If parsing fails, try to split by comma or newline
          normalizedBody.topicKeyPoints = normalizedBody.topicKeyPoints
            .split(/[,\n]/)
            .map((item: string) => item.trim())
            .filter((item: string) => item.length > 0);
        }
      }
      // Convert object with numeric keys to array (form data format)
      if (
        normalizedBody.topicKeyPoints &&
        typeof normalizedBody.topicKeyPoints === "object" &&
        !Array.isArray(normalizedBody.topicKeyPoints)
      ) {
        normalizedBody.topicKeyPoints = objectToArray(normalizedBody.topicKeyPoints);
      }
      // Ensure it's an array
      if (!Array.isArray(normalizedBody.topicKeyPoints)) {
        normalizedBody.topicKeyPoints = [];
      }
    }

    // Validate request body
    const parsed = narratedVideoSchema.safeParse(normalizedBody);
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

    // Look up avatarType from database
    let avatarType: string | undefined;
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

    if (!avatarType) {
      return res.status(400).json({
        success: false,
        message:
          "avatarType is required. Avatar must exist in the database with avatarType field.",
      });
    }

    // Get user name from database
    const dbUser = await User.findOne({ email: data.email });
    const userName = dbUser
      ? `${dbUser.firstName || ""} ${dbUser.lastName || ""}`.trim() ||
        dbUser.email
      : data.email;

    // Prepare webhook payload matching the curl example format
    const webhookPayload = {
      email: data.email,
      name: userName,
      social_handles: data.socialHandles || "",
      avatar: data.avatar,
      music: data.musicUrl, // Use musicUrl from frontend
      videoCaption: true,
      voiceId: data.voice,
      title: data.title,
      videoType: "narratedVideo",
      useMusic: "yes",
      avatarType: avatarType,
      topic: data.videoTopic,
      keyPoints: data.topicKeyPoints,
      style: data.style || "",
    };

    // Forward to webhook asynchronously (fire and forget)
    sendFireAndForgetWebhook(NARRATED_VIDEO_WEBHOOK_URL, webhookPayload);

    // Generate captions in background using topicKeyPoints
    (async () => {
      try {
        // Combine key points into a string
        const keyPointsText = data.topicKeyPoints.join(". ");

        if (keyPointsText) {
          // Get user for userContext
          const user = await User.findOne({ email: data.email });
          const userContext = {
            name: userName,
            position: "",
            companyName: "",
            city: data.city || "",
            socialHandles: data.socialHandles || "",
          };

          // Generate 6 different platform-specific captions using OpenAI
          const captions = await CaptionGenerationService.generateCaptions(
            data.videoTopic || data.title, // Topic
            keyPointsText, // Key Points
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
              topic: data.videoTopic || data.title,
              keyPoints: keyPointsText,
              userContext,
              userId: user?._id?.toString(),
              platforms: [...SOCIAL_MEDIA_PLATFORMS],
              isDynamic: false,
              isPending: false, // Captions are ready, just waiting for video
            },
            { upsert: true, new: true }
          );

          console.log(
            `✅ Generated ${captionCount} unique platform captions for narrated video: ${data.title} (${data.email})`
          );
          console.log(
            `   Platforms: Instagram, Facebook, LinkedIn, Twitter, TikTok, YouTube`
          );
        }
      } catch (captionError: any) {
        // Silently fail - captions are optional
        console.error(
          "Failed to generate captions for narrated video:",
          captionError?.message || captionError
        );
      }
    })();

    // Return immediately without waiting for webhook response
    return res.json({
      success: true,
      message: "Narrated video is in progress",
      data: {
        status: "processing",
        timestamp: data.timestamp || new Date().toISOString(),
        estimated_completion: new Date(
          Date.now() + ESTIMATED_COMPLETION_MINUTES * 60 * 1000
        ).toISOString(),
        note: "Video generation is running in the background. The video will be available when ready.",
      },
    });
  } catch (error: any) {
    console.error("Failed to create narrated video:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create narrated video",
      error: error?.message || "Unknown error",
    });
  }
}
