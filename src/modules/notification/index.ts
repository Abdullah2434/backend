// ==================== NOTIFICATION MODULE EXPORTS ====================

// Main service
export {
  NotificationService,
  default as NotificationServiceDefault,
} from "./services/notification.service";

// Types
export * from "./types/notification.types";

// ==================== NOTIFICATION MODULE CONFIGURATION ====================

export const notificationModuleConfig = {
  name: "Notification Module",
  version: "1.0.0",
  description:
    "WebSocket-based real-time notification service with room management",
  services: ["NotificationService"],
  features: [
    "WebSocket connection management",
    "User room management",
    "Real-time notifications",
    "Photo avatar progress tracking",
    "Video download progress tracking",
    "Broadcast messaging",
    "Connection health monitoring",
    "Event logging",
    "Rate limiting support",
    "CORS configuration",
  ],
  dependencies: ["socket.io", "http"],
};

// ==================== CONVENIENCE EXPORTS ====================

// Create a singleton instance for easy importing
import { NotificationService } from "./services/notification.service";

const notificationService = new NotificationService();

// Export the singleton instance
export { notificationService };
