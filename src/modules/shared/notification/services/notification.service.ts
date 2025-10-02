import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import {
  NotificationConfig,
  NotificationServiceConfig,
  NotificationEvent,
  PhotoAvatarProgressEvent,
  VideoDownloadProgressEvent,
  NotificationResult,
  ConnectionResult,
  RoomJoinResult,
  NotificationHealthStatus,
  NotificationLogEntry,
  NotificationMiddleware,
  BroadcastOptions,
  BroadcastResult,
} from "../types/notification.types";

export class NotificationService {
  private io: SocketIOServer | null = null;
  private server: HTTPServer | null = null;
  private config: NotificationConfig;
  private startTime: Date;
  private activeConnections: Map<string, Socket> = new Map();
  private userRooms: Map<string, string[]> = new Map();
  private logs: NotificationLogEntry[] = [];

  constructor(config?: Partial<NotificationConfig>) {
    this.config = {
      cors: {
        origin: process.env.FRONTEND_URL || "https://www.edgeairealty.com",
        methods: ["GET", "POST"],
      },
      connectionTimeout: 45000,
      pingTimeout: 60000,
      pingInterval: 25000,
      ...config,
    };
    this.startTime = new Date();
  }

  public initialize(server: HTTPServer): ConnectionResult {
    try {
      this.server = server;
      this.io = new SocketIOServer(server, {
        cors: this.config.cors,
        connectionStateRecovery: {
          maxDisconnectionDuration: 2 * 60 * 1000,
          skipMiddlewares: true,
        },
        connectTimeout: this.config.connectionTimeout,
        pingTimeout: this.config.pingTimeout,
        pingInterval: this.config.pingInterval,
      });

      this.setupEventHandlers();
      this.logEvent("connection", "Notification service initialized", {
        server: "initialized",
      });

      return {
        success: true,
      };
    } catch (error: any) {
      this.logEvent("error", "Failed to initialize notification service", {
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on("connection", (socket: Socket) => {
      this.activeConnections.set(socket.id, socket);
      this.logEvent("connection", `User connected: ${socket.id}`, {
        socketId: socket.id,
      });

      socket.on("join-room", (userId: string) => {
        this.handleJoinRoom(socket, userId);
      });

      socket.on("leave-room", (userId: string) => {
        this.handleLeaveRoom(socket, userId);
      });

      socket.on("disconnect", () => {
        this.handleDisconnection(socket);
      });

      socket.on("error", (error: Error) => {
        this.logEvent("error", `Socket error for ${socket.id}`, {
          error: error.message,
          socketId: socket.id,
        });
      });
    });
  }

  private handleJoinRoom(socket: Socket, userId: string): RoomJoinResult {
    try {
      const roomId = `user-${userId}`;
      socket.join(roomId);

      // Track user rooms
      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, []);
      }
      this.userRooms.get(userId)!.push(roomId);

      this.logEvent("connection", `User ${userId} joined room ${roomId}`, {
        userId,
        roomId,
        socketId: socket.id,
      });

      return {
        success: true,
        roomId,
        socketId: socket.id,
      };
    } catch (error: any) {
      this.logEvent("error", `Failed to join room for user ${userId}`, {
        error: error.message,
        userId,
        socketId: socket.id,
      });
      return {
        success: false,
        roomId: "",
        socketId: socket.id,
        error: error.message,
      };
    }
  }

  private handleLeaveRoom(socket: Socket, userId: string): void {
    try {
      const roomId = `user-${userId}`;
      socket.leave(roomId);

      // Remove from user rooms tracking
      const userRooms = this.userRooms.get(userId);
      if (userRooms) {
        const index = userRooms.indexOf(roomId);
        if (index > -1) {
          userRooms.splice(index, 1);
          if (userRooms.length === 0) {
            this.userRooms.delete(userId);
          }
        }
      }

      this.logEvent("connection", `User ${userId} left room ${roomId}`, {
        userId,
        roomId,
        socketId: socket.id,
      });
    } catch (error: any) {
      this.logEvent("error", `Failed to leave room for user ${userId}`, {
        error: error.message,
        userId,
        socketId: socket.id,
      });
    }
  }

  private handleDisconnection(socket: Socket): void {
    this.activeConnections.delete(socket.id);
    this.logEvent("disconnection", `User disconnected: ${socket.id}`, {
      socketId: socket.id,
    });
  }

  public notifyUser(
    userId: string,
    event: string,
    data: any
  ): NotificationResult {
    try {
      if (!this.io) {
        return {
          success: false,
          error: "Notification service not initialized",
        };
      }

      const roomId = `user-${userId}`;
      const room = this.io.sockets.adapter.rooms.get(roomId);
      const recipientCount = room ? room.size : 0;

      if (recipientCount === 0) {
        this.logEvent(
          "notification",
          `No active connections for user ${userId}`,
          { userId, event }
        );
        return {
          success: true,
          message: "No active connections",
          recipients: 0,
        };
      }

      this.io.to(roomId).emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
        userId,
      });

      this.logEvent("notification", `Notification sent to user ${userId}`, {
        userId,
        event,
        recipients: recipientCount,
      });

      return {
        success: true,
        message: "Notification sent successfully",
        recipients: recipientCount,
      };
    } catch (error: any) {
      this.logEvent("error", `Failed to notify user ${userId}`, {
        error: error.message,
        userId,
        event,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  public notifyPhotoAvatarProgress(
    userId: string,
    step: string,
    status: "progress" | "success" | "error",
    data?: any
  ): NotificationResult {
    const eventData: PhotoAvatarProgressEvent = {
      step,
      status,
      data,
      timestamp: new Date().toISOString(),
    };

    return this.notifyUser(userId, "photo-avatar-update", eventData);
  }

  public notifyVideoDownloadProgress(
    userId: string,
    step: string,
    status: "progress" | "success" | "error",
    data?: any
  ): NotificationResult {
    const eventData: VideoDownloadProgressEvent = {
      step,
      status,
      data,
      timestamp: new Date().toISOString(),
    };

    return this.notifyUser(userId, "video-download-update", eventData);
  }

  public broadcast(options: BroadcastOptions): BroadcastResult {
    try {
      if (!this.io) {
        return {
          success: false,
          recipients: 0,
          error: "Notification service not initialized",
        };
      }

      let recipients = 0;

      if (options.roomId) {
        this.io.to(options.roomId).emit(options.event, options.data);
        const room = this.io.sockets.adapter.rooms.get(options.roomId);
        recipients = room ? room.size : 0;
      } else if (options.userId) {
        const result = this.notifyUser(
          options.userId,
          options.event,
          options.data
        );
        recipients = result.recipients || 0;
      } else {
        this.io.emit(options.event, options.data);
        recipients = this.activeConnections.size;
      }

      this.logEvent("notification", `Broadcast sent`, {
        event: options.event,
        recipients,
      });

      return {
        success: true,
        recipients,
      };
    } catch (error: any) {
      this.logEvent("error", `Broadcast failed`, {
        error: error.message,
        event: options.event,
      });
      return {
        success: false,
        recipients: 0,
        error: error.message,
      };
    }
  }

  public getActiveConnections(): number {
    return this.activeConnections.size;
  }

  public getActiveRooms(): number {
    return this.userRooms.size;
  }

  public getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  public getLogs(limit: number = 100): NotificationLogEntry[] {
    return this.logs.slice(-limit);
  }

  public clearLogs(): void {
    this.logs = [];
  }

  private logEvent(
    type: "connection" | "disconnection" | "notification" | "error",
    message: string,
    data?: any
  ): void {
    const logEntry: NotificationLogEntry = {
      timestamp: new Date(),
      type,
      socketId: data?.socketId || "system",
      message,
      data,
    };

    this.logs.push(logEntry);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    console.log(
      `[NotificationService] ${type.toUpperCase()}: ${message}`,
      data || ""
    );
  }

  public healthCheck(): NotificationHealthStatus {
    const isHealthy = this.io !== null && this.server !== null;
    const lastActivity =
      this.logs.length > 0
        ? this.logs[this.logs.length - 1].timestamp
        : undefined;

    return {
      status: isHealthy ? "healthy" : "unhealthy",
      connected: isHealthy,
      activeConnections: this.getActiveConnections(),
      activeRooms: this.getActiveRooms(),
      uptime: this.getUptime(),
      lastActivity,
    };
  }

  public disconnect(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    this.activeConnections.clear();
    this.userRooms.clear();
    this.logEvent("connection", "Notification service disconnected");
  }
}

export default NotificationService;
