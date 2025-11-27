/**
 * Helper functions for photo avatar worker
 */

import axios from "axios";
import fs from "fs";
import DefaultAvatar from "../models/avatar";
import { notificationService } from "../services/notification.service";
import {
  API_KEY,
  UPLOAD_URL,
  AVATAR_GROUP_URL,
  TRAIN_URL,
  TRAINING_DELAY_MS,
  ERROR_CODES,
} from "../constants/photoAvatarWorker.constants";

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate temporary avatar ID
 */
export function generateTempAvatarId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Cleanup temporary image file
 */
export function cleanupTempImage(imagePath: string): void {
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
}

/**
 * Handle upload error and send notification
 */
export function handleUploadError(
  uploadError: any,
  userId: string,
  name: string
): void {
  let errorCode: string = ERROR_CODES.UPLOAD_FAILED;
  let userFriendlyMessage = "Failed to upload image to HeyGen. Please try again.";

  if (uploadError.response) {
    const status = uploadError.response.status;
    if (status === 401) {
      errorCode = ERROR_CODES.AUTH_FAILED;
      userFriendlyMessage = "Authentication failed. Please contact support.";
    } else if (status === 413) {
      errorCode = ERROR_CODES.FILE_TOO_LARGE;
      userFriendlyMessage = "Image file is too large. Please use a smaller image.";
    } else if (status === 415) {
      errorCode = ERROR_CODES.UNSUPPORTED_FORMAT;
      userFriendlyMessage = "Unsupported image format. Please use JPEG, PNG, or WebP.";
    } else if (status >= 500) {
      errorCode = ERROR_CODES.SERVER_ERROR;
      userFriendlyMessage = "Server error. Please try again later.";
    }
  } else if (uploadError.request) {
    errorCode = ERROR_CODES.NETWORK_ERROR;
    userFriendlyMessage = "Network error. Please check your connection and try again.";
  }

  notificationService.notifyPhotoAvatarProgress(userId, "upload", "error", {
    message: userFriendlyMessage,
    error: uploadError.message,
    errorCode: errorCode,
    details: {
      status: uploadError.response?.status,
      response: uploadError.response?.data,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Handle training error and send notification
 */
export function handleTrainingError(
  trainError: any,
  userId: string,
  name: string,
  avatar_id: string,
  group_id: string
): void {
  let errorCode: string = ERROR_CODES.TRAINING_FAILED;
  let userFriendlyMessage = "Failed to start avatar training. Please try again.";

  if (trainError.response) {
    const status = trainError.response.status;
    const apiError = trainError.response.data?.error;

    if (status === 400) {
      if (
        apiError?.code === "invalid_parameter" &&
        apiError?.message?.includes("No valid image for training found")
      ) {
        errorCode = ERROR_CODES.INVALID_IMAGE;
        userFriendlyMessage =
          "The uploaded image cannot be used for avatar training. Please ensure the image shows a clear, well-lit photo of a person's face.";
      } else {
        errorCode = ERROR_CODES.INVALID_PARAMETERS;
        userFriendlyMessage = "Invalid parameters for avatar training. Please try again.";
      }
    } else if (status === 401) {
      errorCode = ERROR_CODES.AUTH_FAILED;
      userFriendlyMessage = "Authentication failed. Please contact support.";
    } else if (status === 429) {
      errorCode = ERROR_CODES.RATE_LIMITED;
      userFriendlyMessage = "Too many requests. Please wait a moment and try again.";
    } else if (status >= 500) {
      errorCode = ERROR_CODES.SERVER_ERROR;
      userFriendlyMessage = "Server error. Please try again later.";
    }
  } else if (trainError.request) {
    errorCode = ERROR_CODES.NETWORK_ERROR;
    userFriendlyMessage = "Network error. Please check your connection and try again.";
  }

  notificationService.notifyPhotoAvatarProgress(userId, "training", "error", {
    message: userFriendlyMessage,
    error: trainError.message,
    errorCode: errorCode,
    details: {
      status: trainError.response?.status,
      response: trainError.response?.data,
      groupId: group_id,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Handle group creation error and send notification
 */
export function handleGroupCreationError(
  groupErr: any,
  userId: string,
  name: string
): void {
  if (
    typeof groupErr === "object" &&
    groupErr !== null &&
    "response" in groupErr
  ) {
    const errObj = groupErr as any;
    let errorMessage = "Failed to create avatar group. Please try again.";
    let errorCode: string = ERROR_CODES.UNKNOWN_ERROR;
    let userFriendlyMessage = "Something went wrong. Please try again.";

    if (errObj.response?.status === 400) {
      const apiErrorCode = errObj.response?.data?.error?.code;
      const apiErrorMessage = errObj.response?.data?.error?.message;

      if (apiErrorCode === "insufficient_credit") {
        errorCode = ERROR_CODES.INSUFFICIENT_CREDITS;
        errorMessage = "Insufficient credits to create avatar. Please contact support.";
        userFriendlyMessage =
          "You don't have enough credits to create an avatar. Please contact support or upgrade your plan.";
      } else if (apiErrorCode === "invalid_parameter") {
        errorCode = ERROR_CODES.INVALID_IMAGE;
        if (apiErrorMessage?.includes("No valid image for training found")) {
          errorMessage =
            "The uploaded image could not be processed for avatar training.";
          userFriendlyMessage =
            "The image you uploaded cannot be used for avatar training. Please ensure the image shows a clear, well-lit photo of a person's face with good contrast and no obstructions.";
        } else {
          errorMessage =
            "Invalid image parameters. Please use a clear photo of a person with good lighting.";
          userFriendlyMessage =
            "The image doesn't meet the requirements. Please use a clear, well-lit photo of a person's face.";
        }
      } else if (apiErrorCode === "invalid_image_format") {
        errorCode = ERROR_CODES.UNSUPPORTED_FORMAT;
        errorMessage = "Unsupported image format. Please use JPEG, PNG, or WebP format.";
        userFriendlyMessage =
          "The image format is not supported. Please use JPEG, PNG, or WebP format.";
      } else if (apiErrorCode === "image_too_small") {
        errorCode = ERROR_CODES.IMAGE_TOO_SMALL;
        errorMessage =
          "Image resolution is too low. Please use a higher quality image (minimum 256x256 pixels).";
        userFriendlyMessage =
          "The image resolution is too low. Please use a higher quality image (at least 256x256 pixels).";
      } else if (apiErrorCode === "image_too_large") {
        errorCode = ERROR_CODES.IMAGE_TOO_LARGE;
        errorMessage = "Image file is too large. Please use an image smaller than 10MB.";
        userFriendlyMessage =
          "The image file is too large. Please use an image smaller than 10MB.";
      } else {
        errorCode = ERROR_CODES.INVALID_IMAGE;
        errorMessage =
          apiErrorMessage ||
          "Invalid image format or size. Please use a clear photo of a person.";
        userFriendlyMessage =
          "The image doesn't meet the requirements. Please use a clear, well-lit photo of a person's face.";
      }
    } else if (errObj.response?.status === 429) {
      errorCode = ERROR_CODES.RATE_LIMITED;
      errorMessage = "Too many requests. Please wait a moment and try again.";
      userFriendlyMessage = "Too many requests. Please wait a moment and try again.";
    } else if (errObj.response?.status === 401) {
      errorCode = ERROR_CODES.AUTH_FAILED;
      errorMessage = "Authentication failed. Please contact support.";
      userFriendlyMessage = "Authentication failed. Please contact support.";
    } else if (errObj.response?.status === 403) {
      errorCode = ERROR_CODES.ACCESS_DENIED;
      errorMessage = "Access denied. Please contact support.";
      userFriendlyMessage = "Access denied. Please contact support.";
    } else if (errObj.response?.status >= 500) {
      errorCode = ERROR_CODES.SERVER_ERROR;
      errorMessage = "Server error. Please try again later.";
      userFriendlyMessage = "Server error. Please try again later.";
    }

    notificationService.notifyPhotoAvatarProgress(userId, "group-creation", "error", {
      message: userFriendlyMessage,
      error: errorMessage,
      errorCode: errorCode,
      statusCode: errObj.response?.status,
      details: {
        apiError: errObj.response?.data?.error,
        timestamp: new Date().toISOString(),
      },
    });
  } else {
    notificationService.notifyPhotoAvatarProgress(userId, "group-creation", "error", {
      message: "Failed to create avatar group. Please try again.",
      error: "Unknown error occurred",
      errorCode: ERROR_CODES.UNKNOWN_ERROR,
      details: {
        error: groupErr instanceof Error ? groupErr.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Handle general processing error and send notification
 */
export function handleProcessingError(
  error: any,
  userId: string,
  imagePath: string
): void {
  let errorCode: string = ERROR_CODES.PROCESSING_ERROR;
  let userFriendlyMessage = "Failed to create your custom avatar. Please try again.";
  let technicalError = "Unknown error occurred";

  if (error instanceof Error) {
    technicalError = error.message;

    if (error.message.includes("ENOENT") || error.message.includes("no such file")) {
      errorCode = ERROR_CODES.FILE_NOT_FOUND;
      userFriendlyMessage =
        "The uploaded image file was not found. Please try uploading again.";
    } else if (
      error.message.includes("EACCES") ||
      error.message.includes("permission denied")
    ) {
      errorCode = ERROR_CODES.PERMISSION_ERROR;
      userFriendlyMessage =
        "Permission error accessing the image file. Please try again.";
    } else if (error.message.includes("network") || error.message.includes("timeout")) {
      errorCode = ERROR_CODES.NETWORK_ERROR;
      userFriendlyMessage =
        "Network error occurred. Please check your connection and try again.";
    } else if (error.message.includes("validation")) {
      errorCode = ERROR_CODES.VALIDATION_ERROR;
      userFriendlyMessage =
        "Image validation failed. Please ensure you're uploading a valid image file.";
    }
  }

  notificationService.notifyPhotoAvatarProgress(userId, "error", "error", {
    message: userFriendlyMessage,
    error: technicalError,
    errorCode: errorCode,
    details: {
      timestamp: new Date().toISOString(),
      userId: userId,
      imagePath: imagePath,
    },
  });
}

/**
 * Upload image to HeyGen
 */
export async function uploadImageToHeyGen(
  imagePath: string,
  mimeType: string | undefined,
  userId: string,
  name: string
): Promise<string> {
  const imageBuffer = fs.readFileSync(imagePath);

  try {
    const uploadRes = await axios.post(UPLOAD_URL, imageBuffer, {
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": mimeType || "image/jpeg",
      },
    });

    const image_key = uploadRes.data?.data?.image_key;
    if (!image_key) {
      notificationService.notifyPhotoAvatarProgress(userId, "upload", "error", {
        message: "Failed to upload image to HeyGen. Please try again.",
        error: "No image_key returned from HeyGen",
        errorCode: ERROR_CODES.UPLOAD_FAILED,
        details: {
          response: uploadRes.data,
          timestamp: new Date().toISOString(),
        },
      });
      throw new Error("HeyGen image upload failed, no image_key returned");
    }

    return image_key;
  } catch (uploadError: any) {
    handleUploadError(uploadError, userId, name);
    throw uploadError;
  }
}

/**
 * Create avatar group in HeyGen
 */
export async function createAvatarGroup(
  name: string,
  image_key: string,
  userId: string
): Promise<{ avatar_id: string; group_id: string; preview_image_url: string }> {
  const groupPayload = { name, image_key };

  try {
    const groupRes = await axios.post(AVATAR_GROUP_URL, groupPayload, {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": API_KEY,
      },
    });

    return {
      avatar_id: groupRes.data.data.id,
      group_id: groupRes.data.data.group_id,
      preview_image_url: groupRes.data.data.image_url,
    };
  } catch (groupErr) {
    handleGroupCreationError(groupErr, userId, name);
    throw groupErr;
  }
}

/**
 * Train avatar group in HeyGen
 */
export async function trainAvatarGroup(
  group_id: string,
  userId: string,
  name: string,
  avatar_id: string
): Promise<any> {
  try {
    const response = await axios.post(
      TRAIN_URL,
      { group_id },
      {
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "X-Api-Key": API_KEY,
        },
      }
    );
    return response;
  } catch (trainError: any) {
    handleTrainingError(trainError, userId, name, avatar_id, group_id);
    throw trainError;
  }
}

/**
 * Save avatar to database
 */
export async function saveAvatarToDatabase(
  avatar_id: string,
  name: string,
  gender: string,
  preview_image_url: string,
  userId: string,
  ethnicity: string,
  age_group: string,
  avatarType: string
): Promise<void> {
  await DefaultAvatar.create({
    avatar_id: avatar_id,
    avatar_name: name,
    gender,
    preview_image_url,
    preview_video_url: "",
    default: false,
    userId,
    ethnicity,
    status: "pending",
    age_group,
    avatarType: avatarType,
  });
}

/**
 * Wait for training delay
 */
export async function waitForTrainingDelay(): Promise<void> {
  await new Promise((r) => setTimeout(r, TRAINING_DELAY_MS));
}

