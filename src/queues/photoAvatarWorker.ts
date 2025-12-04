import { Worker } from "bullmq";
import { notificationService } from "../services/notification.service";
import { redisConnection } from "../constants/photoAvatarWorker.constants";
import {
  generateTempAvatarId,
  cleanupTempImage,
  handleProcessingError,
  uploadImageToHeyGen,
  createAvatarGroup,
  trainAvatarGroup,
  saveAvatarToDatabase,
  waitForTrainingDelay,
} from "../utils/photoAvatarWorkerHelpers";

export const worker = new Worker(
  "photo-avatar",
  async (job) => {
    const { imagePath, age_group, name, gender, userId, ethnicity, mimeType } =
      job.data;

    try {
      // Notify user that processing has started
      const tempAvatarId = generateTempAvatarId();
      notificationService.notifyPhotoAvatarProgress(
        userId,
        "upload",
        "progress",
        {
          message: "Uploading your photo to HeyGen...",
          avatarName: name,
          avatarId: tempAvatarId,
        }
      );

      // 1. Upload image to HeyGen
      const image_key = await uploadImageToHeyGen(
        imagePath,
        mimeType,
          userId,
        name
      );

      // Notify successful upload
      notificationService.notifyPhotoAvatarProgress(
        userId,
        "upload",
        "success",
        {
          message: "Image uploaded successfully!",
          avatarName: name,
          avatarId: generateTempAvatarId(),
        }
      );

      // 2. Create avatar group
      notificationService.notifyPhotoAvatarProgress(
        userId,
        "group-creation",
        "progress",
        {
          message: "Creating avatar group...",
          avatarName: name,
          avatarId: generateTempAvatarId(),
        }
      );

      try {
        const { avatar_id, group_id, preview_image_url } =
          await createAvatarGroup(name, image_key, userId);

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

        // Wait before training
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

        await waitForTrainingDelay();

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

        const response = await trainAvatarGroup(
              group_id,
            userId,
          name,
          avatar_id
        );

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

        const returnedAvatarType =
          (response as any)?.data?.data?.avatarType || "photo_avatar";

        await saveAvatarToDatabase(
          avatar_id,
          name,
          gender,
          preview_image_url,
          userId,
          ethnicity,
          age_group,
          returnedAvatarType
        );

        // Cleanup temp image
        cleanupTempImage(imagePath);

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
        cleanupTempImage(imagePath);
        throw groupErr;
      }
    } catch (error) {
      handleProcessingError(error, userId, imagePath);
      cleanupTempImage(imagePath);
      throw error;
    }
  },
  { connection: redisConnection }
);
