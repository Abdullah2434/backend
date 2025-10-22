import { Worker } from "bullmq";
import axios from "axios";
import DefaultAvatar from "../models/avatar";
import fs from "fs";
import dotenv from "dotenv";
import { photoAvatarQueue } from "./photoAvatarQueue";
import { notificationService } from "../services/notification.service";
dotenv.config();

const API_KEY = process.env.HEYGEN_API_KEY;
const UPLOAD_URL = "https://upload.heygen.com/v1/asset";
const AVATAR_GROUP_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/avatar_group/create`;
const TRAIN_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/train`;

const redisConnection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

export const worker = new Worker(
  "photo-avatar",
  async (job) => {
    const { imagePath, age_group, name, gender, userId, ethnicity, mimeType } =
      job.data;

    try {
      // Notify user that processing has started
      notificationService.notifyPhotoAvatarProgress(
        userId,
        "upload",
        "progress",
        {
          message: "Uploading your photo to HeyGen...",
          avatarName: name, // Include avatar name for better identification
          avatarId: `temp-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`, // Temporary ID until we get the real one
        }
      );

      // 1. Upload image to HeyGen
      const imageBuffer = fs.readFileSync(imagePath);
      let uploadRes;

      try {
        uploadRes = await axios.post(UPLOAD_URL, imageBuffer, {
          headers: {
            "x-api-key": API_KEY,
            "Content-Type": mimeType || "image/jpeg",
          },
        });
      } catch (uploadError: any) {
        console.error("HeyGen upload request failed:", uploadError);

        let errorCode = "upload_failed";
        let userFriendlyMessage =
          "Failed to upload image to HeyGen. Please try again.";

        if (uploadError.response) {
          // Server responded with error status
          const status = uploadError.response.status;
          if (status === 401) {
            errorCode = "auth_failed";
            userFriendlyMessage =
              "Authentication failed. Please contact support.";
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
        } else if (uploadError.request) {
          // Network error
          errorCode = "network_error";
          userFriendlyMessage =
            "Network error. Please check your connection and try again.";
        }

        notificationService.notifyPhotoAvatarProgress(
          userId,
          "upload",
          "error",
          {
            message: userFriendlyMessage,
            error: uploadError.message,
            errorCode: errorCode,
            details: {
              status: uploadError.response?.status,
              response: uploadError.response?.data,
              timestamp: new Date().toISOString(),
            },
          }
        );

        throw uploadError;
      }
      const image_key = uploadRes.data?.data?.image_key;
      if (!image_key) {
        console.error(
          "HeyGen image upload failed, no image_key returned:",
          uploadRes.data
        );
        notificationService.notifyPhotoAvatarProgress(
          userId,
          "upload",
          "error",
          {
            message: "Failed to upload image to HeyGen. Please try again.",
            error: "No image_key returned from HeyGen",
            errorCode: "upload_failed",
            details: {
              response: uploadRes.data,
              timestamp: new Date().toISOString(),
            },
          }
        );
        throw new Error("HeyGen image upload failed, no image_key returned");
      }

      // Notify successful upload
      notificationService.notifyPhotoAvatarProgress(
        userId,
        "upload",
        "success",
        {
          message: "Image uploaded successfully!",
          avatarName: name,
          avatarId: `temp-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
        }
      );

      // 2. Create avatar group
      const groupPayload = {
        name,
        image_key,
      };

      notificationService.notifyPhotoAvatarProgress(
        userId,
        "group-creation",
        "progress",
        {
          message: "Creating avatar group...",
          avatarName: name,
          avatarId: `temp-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
        }
      );

      try {
        const groupRes = await axios.post(AVATAR_GROUP_URL, groupPayload, {
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "X-Api-Key": API_KEY,
          },
        });
        const avatar_id = groupRes.data.data.id;
        const group_id = groupRes.data.data.group_id;
        const preview_image_url = groupRes.data.data.image_url;

        notificationService.notifyPhotoAvatarProgress(
          userId,
          "group-creation",
          "success",
          {
            message: "Avatar group created successfully!",
            avatarName: name,
            avatarId: avatar_id,
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
            avatarName: name,
            avatarId: avatar_id,
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
            avatarName: name,
            avatarId: avatar_id,
          }
        );

        let response;
        try {
          response = await axios.post(
            TRAIN_URL,
            {
              group_id,
            },
            {
              headers: {
                accept: "application/json",
                "Content-Type": "application/json",
                "X-Api-Key": API_KEY,
              },
            }
          );
        } catch (trainError: any) {
          console.error("HeyGen training request failed:", trainError);

          let errorCode = "training_failed";
          let userFriendlyMessage =
            "Failed to start avatar training. Please try again.";

          if (trainError.response) {
            const status = trainError.response.status;
            const apiError = trainError.response.data?.error;

            if (status === 400) {
              if (
                apiError?.code === "invalid_parameter" &&
                apiError?.message?.includes("No valid image for training found")
              ) {
                errorCode = "invalid_image";
                userFriendlyMessage =
                  "The uploaded image cannot be used for avatar training. Please ensure the image shows a clear, well-lit photo of a person's face.";
              } else {
                errorCode = "invalid_parameters";
                userFriendlyMessage =
                  "Invalid parameters for avatar training. Please try again.";
              }
            } else if (status === 401) {
              errorCode = "auth_failed";
              userFriendlyMessage =
                "Authentication failed. Please contact support.";
            } else if (status === 429) {
              errorCode = "rate_limited";
              userFriendlyMessage =
                "Too many requests. Please wait a moment and try again.";
            } else if (status >= 500) {
              errorCode = "server_error";
              userFriendlyMessage = "Server error. Please try again later.";
            }
          } else if (trainError.request) {
            errorCode = "network_error";
            userFriendlyMessage =
              "Network error. Please check your connection and try again.";
          }

          notificationService.notifyPhotoAvatarProgress(
            userId,
            "training",
            "error",
            {
              message: userFriendlyMessage,
              error: trainError.message,
              errorCode: errorCode,
              details: {
                status: trainError.response?.status,
                response: trainError.response?.data,
                groupId: group_id,
                timestamp: new Date().toISOString(),
              },
            }
          );

          throw trainError;
        }

        console.log("Train response:", response.data);

        // 4. Save custom avatar in DB
        notificationService.notifyPhotoAvatarProgress(
          userId,
          "saving",
          "progress",
          {
            message: "Saving your avatar...",
            avatarName: name,
            avatarId: avatar_id,
          }
        );

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
        });

        // Cleanup temp image
        fs.unlinkSync(imagePath);

        // Final success notification
        notificationService.notifyPhotoAvatarProgress(
          userId,
          "complete",
          "success",
          {
            message: "Your avatar has been submitted for training!",
            avatarName: name,
            avatarId: avatar_id,
            previewImageUrl: preview_image_url,
          }
        );

        return true;
      } catch (groupErr) {
        // Enhanced error logging for HeyGen API
        if (
          typeof groupErr === "object" &&
          groupErr !== null &&
          "response" in groupErr
        ) {
          const errObj = groupErr as any;
          console.error("HeyGen avatar group creation failed:", {
            status: errObj.response?.status,
            data: errObj.response?.data,
            payload: groupPayload,
          });

          // Notify user about specific error
          let errorMessage = "Failed to create avatar group. Please try again.";
          let errorCode = "unknown_error";
          let userFriendlyMessage = "Something went wrong. Please try again.";

          console.log("Error object:", errObj.response);

          if (errObj.response?.status === 400) {
            // Check for specific error codes in the response
            const apiErrorCode = errObj.response?.data?.error?.code;
            const apiErrorMessage = errObj.response?.data?.error?.message;

            if (apiErrorCode === "insufficient_credit") {
              errorCode = "insufficient_credits";
              errorMessage =
                "Insufficient credits to create avatar. Please contact support.";
              userFriendlyMessage =
                "You don't have enough credits to create an avatar. Please contact support or upgrade your plan.";
            } else if (apiErrorCode === "invalid_parameter") {
              errorCode = "invalid_image";
              if (
                apiErrorMessage?.includes("No valid image for training found")
              ) {
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
              errorCode = "unsupported_format";
              errorMessage =
                "Unsupported image format. Please use JPEG, PNG, or WebP format.";
              userFriendlyMessage =
                "The image format is not supported. Please use JPEG, PNG, or WebP format.";
            } else if (apiErrorCode === "image_too_small") {
              errorCode = "image_too_small";
              errorMessage =
                "Image resolution is too low. Please use a higher quality image (minimum 256x256 pixels).";
              userFriendlyMessage =
                "The image resolution is too low. Please use a higher quality image (at least 256x256 pixels).";
            } else if (apiErrorCode === "image_too_large") {
              errorCode = "image_too_large";
              errorMessage =
                "Image file is too large. Please use an image smaller than 10MB.";
              userFriendlyMessage =
                "The image file is too large. Please use an image smaller than 10MB.";
            } else {
              errorCode = "invalid_image";
              errorMessage =
                apiErrorMessage ||
                "Invalid image format or size. Please use a clear photo of a person.";
              userFriendlyMessage =
                "The image doesn't meet the requirements. Please use a clear, well-lit photo of a person's face.";
            }
          } else if (errObj.response?.status === 429) {
            errorCode = "rate_limited";
            errorMessage =
              "Too many requests. Please wait a moment and try again.";
            userFriendlyMessage =
              "Too many requests. Please wait a moment and try again.";
          } else if (errObj.response?.status === 401) {
            errorCode = "auth_failed";
            errorMessage = "Authentication failed. Please contact support.";
            userFriendlyMessage =
              "Authentication failed. Please contact support.";
          } else if (errObj.response?.status === 403) {
            errorCode = "access_denied";
            errorMessage = "Access denied. Please contact support.";
            userFriendlyMessage = "Access denied. Please contact support.";
          } else if (errObj.response?.status >= 500) {
            errorCode = "server_error";
            errorMessage = "Server error. Please try again later.";
            userFriendlyMessage = "Server error. Please try again later.";
          }

          // Send detailed error notification to frontend
          notificationService.notifyPhotoAvatarProgress(
            userId,
            "group-creation",
            "error",
            {
              message: userFriendlyMessage,
              error: errorMessage,
              errorCode: errorCode,
              statusCode: errObj.response?.status,
              details: {
                apiError: errObj.response?.data?.error,
                timestamp: new Date().toISOString(),
              },
            }
          );
        } else {
          console.error("HeyGen avatar group creation error:", groupErr);
          notificationService.notifyPhotoAvatarProgress(
            userId,
            "group-creation",
            "error",
            {
              message: "Failed to create avatar group. Please try again.",
              error: "Unknown error occurred",
              errorCode: "unknown_error",
              details: {
                error:
                  groupErr instanceof Error
                    ? groupErr.message
                    : "Unknown error",
                timestamp: new Date().toISOString(),
              },
            }
          );
        }
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        throw groupErr;
      }
    } catch (error) {
      console.error("Photo avatar worker error:", error);

      // Determine error type and create appropriate message
      let errorCode = "processing_error";
      let userFriendlyMessage =
        "Failed to create your custom avatar. Please try again.";
      let technicalError = "Unknown error occurred";

      if (error instanceof Error) {
        technicalError = error.message;

        // Categorize common errors
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
        } else if (error.message.includes("validation")) {
          errorCode = "validation_error";
          userFriendlyMessage =
            "Image validation failed. Please ensure you're uploading a valid image file.";
        }
      }

      // Send detailed error notification to frontend
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

      // Cleanup temp image
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      throw error;
    }
  },
  { connection: redisConnection }
);
