// Re-export VideoService from the new video module
// This maintains backward compatibility while using the new modular structure
export { VideoService as default } from "../modules/video/services/video.service";