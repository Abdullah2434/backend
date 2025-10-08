import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";

class NotificationService {
  private io: SocketIOServer | null = null;

  initialize(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "https://www.edgeairealty.com",
        methods: ["GET", "POST"],
      },
    });

    this.io.on("connection", (socket: Socket) => {
      console.log("User connected:", socket.id);

      socket.on("join-room", (userId: string) => {
        socket.join(`user-${userId}`);
        console.log(`User ${userId} joined room`);
      });

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });
  }

  notifyUser(userId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`user-${userId}`).emit(event, data);
      console.log(`Notification sent to user ${userId}:`, event, data);
    }
  }

  notifyPhotoAvatarProgress(
    userId: string,
    step: string,
    status: "progress" | "success" | "error",
    data?: any
  ) {
    this.notifyUser(userId, "photo-avatar-update", {
      step,
      status,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  notifyVideoDownloadProgress(
    userId: string,
    step: string,
    status: "progress" | "success" | "error",
    data?: any
  ) {
    this.notifyUser(userId, "video-download-update", {
      step,
      status,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Auto-post status notifications
  notifyAutoPostProgress(
    userId: string,
    step: string,
    status: "progress" | "success" | "error",
    data?: any
  ) {
    this.notifyUser(userId, "auto-post-update", {
      step,
      status,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Scheduled video status notifications
  notifyScheduledVideoProgress(
    userId: string,
    step: string,
    status: "progress" | "success" | "error",
    data?: any
  ) {
    this.notifyUser(userId, "scheduled-video-update", {
      step,
      status,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Enhanced auto-post alert notifications
  notifyAutoPostAlert(
    userId: string,
    alertType: "success" | "failure" | "partial",
    data: {
      scheduleId: string;
      trendIndex: number;
      videoTitle: string;
      successfulPlatforms?: string[];
      failedPlatforms?: string[];
      errorDetails?: string;
      totalPlatforms?: number;
      successCount?: number;
      failureCount?: number;
    }
  ) {
    let alertMessage = "";
    let alertLevel = "info";

    switch (alertType) {
      case "success":
        alertMessage = `🎉 SUCCESS: Auto-post completed successfully! Posted "${
          data.videoTitle
        }" to ${data.successCount}/${
          data.totalPlatforms
        } platforms: ${data.successfulPlatforms?.join(", ")}`;
        alertLevel = "success";
        break;
      case "failure":
        alertMessage = `❌ FAILURE: Auto-post failed! Could not post "${data.videoTitle}" to any platform. Error: ${data.errorDetails}`;
        alertLevel = "error";
        break;
      case "partial":
        alertMessage = `⚠️ PARTIAL SUCCESS: Auto-post completed with some failures. Posted "${
          data.videoTitle
        }" to ${data.successCount}/${
          data.totalPlatforms
        } platforms. Successful: ${data.successfulPlatforms?.join(
          ", "
        )}. Failed: ${data.failedPlatforms?.join(", ")}`;
        alertLevel = "warning";
        break;
    }

    this.notifyUser(userId, "auto-post-alert", {
      alertType,
      alertLevel,
      alertMessage,
      data,
      timestamp: new Date().toISOString(),
    });

    // Also send a general notification
    this.notifyUser(userId, "notification", {
      type: "auto-post-alert",
      title: "Auto-Post Alert",
      message: alertMessage,
      level: alertLevel,
      data,
      timestamp: new Date().toISOString(),
    });
  }
}

export const notificationService = new NotificationService();
