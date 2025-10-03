import VideoCreation, { IVideoCreation } from "../../../models/VideoCreation";
import User from "../../../models/User";
import { VideoGenerationRequest } from "../types/video.types";
import { NotFoundError } from "../../../core/errors";

export class VideoCreationService {
  /**
   * Create a new video creation record
   */
  async createVideoCreationRecord(
    requestData: VideoGenerationRequest,
    requestId: string
  ): Promise<IVideoCreation> {
    // Find user by email
    const user = await User.findOne({ email: requestData.email });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Create video creation record
    const videoCreation = new VideoCreation({
      requestId,
      userId: user._id,
      email: requestData.email,
      title: `${requestData.name} - ${requestData.videoTopic}`,
      prompt: requestData.prompt,
      avatar: Array.isArray(requestData.avatar)
        ? requestData.avatar
        : [requestData.avatar],
      name: requestData.name,
      position: requestData.position,
      companyName: requestData.companyName,
      license: requestData.license,
      tailoredFit: requestData.tailoredFit,
      socialHandles: requestData.socialHandles,
      videoTopic: requestData.videoTopic,
      topicKeyPoints: requestData.topicKeyPoints,
      city: requestData.city,
      preferredTone: requestData.preferredTone,
      callToAction: requestData.callToAction,
      status: "pending",
    });

    await videoCreation.save();
    return videoCreation;
  }

  /**
   * Update video creation status
   */
  async updateVideoCreationStatus(
    requestId: string,
    status: "pending" | "processing" | "completed" | "failed",
    webhookResponse?: any,
    errorMessage?: string
  ): Promise<IVideoCreation | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (webhookResponse) {
      updateData.webhookResponse = webhookResponse;
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    return await VideoCreation.findOneAndUpdate({ requestId }, updateData, {
      new: true,
    });
  }
}

export const videoCreationService = new VideoCreationService();
