// Re-export all video controller functions from the new video module
// This maintains backward compatibility while using the new modular structure
export {
  gallery,
  trackExecution,
  checkPendingWorkflows,
  download,
  updateStatus,
  deleteVideo,
  deleteVideoById,
  downloadProxy,
  getAvatars,
  getVoices,
  createPhotoAvatarUpload,
  createPhotoAvatar,
  createVideo,
  generateVideo,
  getAllTopics,
  getTopicByType,
  getTopicById,
  updateVideoNote,
} from "../modules/video/controllers/video.controller";
