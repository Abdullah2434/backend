import axios from "axios";
import fs from "fs";
import DefaultAvatar from "../../../models/avatar";
import { notificationService } from "../../../services/notification.service";
import { logger } from "../../../core/utils/logger";
import { PhotoAvatarJobData, JobResult } from "../types/job.types";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_BASE_URL = process.env.HEYGEN_BASE_URL;
const UPLOAD_URL = "https://upload.heygen.com/v1/asset";
const AVATAR_GROUP_URL = `${HEYGEN_BASE_URL}/photo_avatar/avatar_group/create`;
const TRAIN_URL = `${HEYGEN_BASE_URL}/photo_avatar/train`;

/**
 * Process photo avatar creation
 */
export async function processPhotoAvatar(
  data: PhotoAvatarJobData
): Promise<JobResult> {
  const { imagePath, age_group, name, gender, userId, ethnicity, mimeType } =
    data;

  try {
    // 1. Upload image to HeyGen
    notificationService.notifyPhotoAvatarProgress(
      userId,
      "upload",
      "progress",
      {
        message: "Uploading your photo to HeyGen...",
      }
    );

    const imageBuffer = fs.readFileSync(imagePath);
    let uploadRes;

    try {
      uploadRes = await axios.post(UPLOAD_URL, imageBuffer, {
        headers: {
          "x-api-key": HEYGEN_API_KEY,
          "Content-Type": mimeType || "image/jpeg",
        },
      });
    } catch (uploadError: any) {
      logger.error("HeyGen upload request failed", uploadError);

      const errorInfo = handleUploadError(uploadError);
      notificationService.notifyPhotoAvatarProgress(
        userId,
        "upload",
        "error",
        errorInfo
      );

      throw uploadError;
    }

    const image_key = uploadRes.data?.data?.image_key;
    if (!image_key) {
      logger.error("HeyGen image upload failed, no image_key returned", {
        response: uploadRes.data,
      });

      notificationService.notifyPhotoAvatarProgress(userId, "upload", "error", {
        message: "Failed to upload image to HeyGen. Please try again.",
        error: "No image_key returned from HeyGen",
        errorCode: "upload_failed",
      });

      throw new Error("HeyGen image upload failed, no image_key returned");
    }

    notificationService.notifyPhotoAvatarProgress(userId, "upload", "success", {
      message: "Image uploaded successfully!",
    });

    // 2. Create avatar group
    notificationService.notifyPhotoAvatarProgress(
      userId,
      "group-creation",
      "progress",
      {
        message: "Creating avatar group...",
      }
    );

    const groupPayload = {
      name,
      image_key,
    };

    let groupRes;
    try {
      groupRes = await axios.post(AVATAR_GROUP_URL, groupPayload, {
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "X-Api-Key": HEYGEN_API_KEY,
        },
      });
    } catch (groupError: any) {
      logger.error("HeyGen avatar group creation failed", {
        error: groupError,
        payload: groupPayload,
      });

      const errorInfo = handleGroupCreationError(groupError);
      notificationService.notifyPhotoAvatarProgress(
        userId,
        "group-creation",
        "error",
        errorInfo
      );

      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      throw groupError;
    }

    const avatar_id = groupRes.data.data.id;
    const group_id = groupRes.data.data.group_id;
    const preview_image_url = groupRes.data.data.image_url;

    notificationService.notifyPhotoAvatarProgress(
      userId,
      "group-creation",
      "success",
      {
        message: "Avatar group created successfully!",
      }
    );

    // Wait 20 seconds before training
    notificationService.notifyPhotoAvatarProgress(
      userId,
      "training",
      "progress",
      {
        message:
          "Preparing to train your avatar (this may take a few minutes)...",
      }
    );

    await new Promise((r) => setTimeout(r, 20000));

    // 3. Train avatar group
    notificationService.notifyPhotoAvatarProgress(
      userId,
      "training",
      "progress",
      {
        message: "Training your avatar with AI...",
      }
    );

    try {
      await axios.post(
        TRAIN_URL,
        { group_id },
        {
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "X-Api-Key": HEYGEN_API_KEY,
          },
        }
      );
    } catch (trainError: any) {
      logger.error("HeyGen training request failed", trainError);

      const errorInfo = handleTrainingError(trainError);
      notificationService.notifyPhotoAvatarProgress(
        userId,
        "training",
        "error",
        errorInfo
      );

      throw trainError;
    }

    // 4. Save custom avatar in DB
    notificationService.notifyPhotoAvatarProgress(
      userId,
      "saving",
      "progress",
      {
        message: "Saving your avatar...",
      }
    );

    await DefaultAvatar.create({
      avatar_id,
      avatar_name: name,
      gender,
      preview_image_url,
      preview_video_url: "",
      default: false,
      userId,
      ethnicity,
      status: "pending",
      age_group,
    });

    // Cleanup temp image
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    // Final success notification
    notificationService.notifyPhotoAvatarProgress(
      userId,
      "complete",
      "success",
      {
        message: "Your avatar has been submitted for training!",
        avatarId: avatar_id,
        previewImageUrl: preview_image_url,
      }
    );

    logger.info("Photo avatar processing completed", {
      userId,
      avatarId: avatar_id,
    });

    return {
      success: true,
      message: "Photo avatar created successfully",
      data: {
        avatarId: avatar_id,
        groupId: group_id,
        previewImageUrl: preview_image_url,
      },
    };
  } catch (error) {
    logger.error("Photo avatar worker error", error);

    // Cleanup temp image
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    const errorInfo = handleGeneralError(error, userId, imagePath);
    notificationService.notifyPhotoAvatarProgress(
      userId,
      "error",
      "error",
      errorInfo
    );

    return {
      success: false,
      message: "Photo avatar creation failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle upload errors
 */
function handleUploadError(error: any) {
  let errorCode = "upload_failed";
  let userFriendlyMessage =
    "Failed to upload image to HeyGen. Please try again.";

  if (error.response) {
    const status = error.response.status;
    if (status === 401) {
      errorCode = "auth_failed";
      userFriendlyMessage = "Authentication failed. Please contact support.";
    } else if (status === 413) {
      errorCode = "file_too_large";
      userFriendlyMessage =
        "Image file is too large. Please use a smaller image.";
    } else if (status === 415) {
      errorCode = "unsupported_format";
      userFriendlyMessage =
        "Unsupported image format. Please use JPEG, PNG, or WebP.";
    } else if (status >= 500) {
      errorCode = "server_error";
      userFriendlyMessage = "Server error. Please try again later.";
    }
  } else if (error.request) {
    errorCode = "network_error";
    userFriendlyMessage =
      "Network error. Please check your connection and try again.";
  }

  return {
    message: userFriendlyMessage,
    error: error.message,
    errorCode,
    details: {
      status: error.response?.status,
      response: error.response?.data,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Handle group creation errors
 */
function handleGroupCreationError(error: any) {
  let errorCode = "unknown_error";
  let userFriendlyMessage = "Failed to create avatar group. Please try again.";

  if (error.response) {
    const status = error.response.status;
    const apiError = error.response.data?.error;

    if (status === 400) {
      const apiErrorCode = apiError?.code;
      const apiErrorMessage = apiError?.message;

      if (apiErrorCode === "insufficient_credit") {
        errorCode = "insufficient_credits";
        userFriendlyMessage =
          "Insufficient credits to create avatar. Please contact support.";
      } else if (apiErrorCode === "invalid_parameter") {
        errorCode = "invalid_image";
        userFriendlyMessage =
          "The image doesn't meet the requirements. Please use a clear, well-lit photo.";
      }
    }
  }

  return {
    message: userFriendlyMessage,
    error: error.message,
    errorCode,
    statusCode: error.response?.status,
    details: {
      apiError: error.response?.data?.error,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Handle training errors
 */
function handleTrainingError(error: any) {
  let errorCode = "training_failed";
  let userFriendlyMessage =
    "Failed to start avatar training. Please try again.";

  if (error.response) {
    const status = error.response.status;
    const apiError = error.response.data?.error;

    if (status === 400) {
      if (
        apiError?.code === "invalid_parameter" &&
        apiError?.message?.includes("No valid image for training found")
      ) {
        errorCode = "invalid_image";
        userFriendlyMessage =
          "The uploaded image cannot be used for avatar training.";
      }
    }
  }

  return {
    message: userFriendlyMessage,
    error: error.message,
    errorCode,
    details: {
      status: error.response?.status,
      response: error.response?.data,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Handle general errors
 */
function handleGeneralError(error: any, userId: string, imagePath: string) {
  let errorCode = "processing_error";
  let userFriendlyMessage =
    "Failed to create your custom avatar. Please try again.";
  let technicalError = "Unknown error occurred";

  if (error instanceof Error) {
    technicalError = error.message;

    if (
      error.message.includes("ENOENT") ||
      error.message.includes("no such file")
    ) {
      errorCode = "file_not_found";
      userFriendlyMessage =
        "The uploaded image file was not found. Please try uploading again.";
    } else if (
      error.message.includes("EACCES") ||
      error.message.includes("permission denied")
    ) {
      errorCode = "permission_error";
      userFriendlyMessage =
        "Permission error accessing the image file. Please try again.";
    } else if (
      error.message.includes("network") ||
      error.message.includes("timeout")
    ) {
      errorCode = "network_error";
      userFriendlyMessage =
        "Network error occurred. Please check your connection and try again.";
    }
  }

  return {
    message: userFriendlyMessage,
    error: technicalError,
    errorCode,
    details: {
      timestamp: new Date().toISOString(),
      userId,
      imagePath,
    },
  };
}
