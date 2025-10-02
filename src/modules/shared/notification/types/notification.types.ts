import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";

// ==================== NOTIFICATION CONFIGURATION TYPES ====================

export interface NotificationConfig {
  cors: {
    origin: string;
    methods: string[];
  };
  connectionTimeout?: number;
  pingTimeout?: number;
  pingInterval?: number;
}

export interface NotificationServiceConfig {
  server: HTTPServer;
  config: NotificationConfig;
}

// ==================== NOTIFICATION EVENT TYPES ====================

export interface NotificationEvent {
  event: string;
  data: any;
  timestamp: string;
  userId?: string;
  roomId?: string;
}

export interface PhotoAvatarProgressEvent {
  step: string;
  status: "progress" | "success" | "error";
  data?: any;
  timestamp: string;
}

export interface VideoDownloadProgressEvent {
  step: string;
  status: "progress" | "success" | "error";
  data?: any;
  timestamp: string;
}

export interface UserConnectionEvent {
  userId: string;
  socketId: string;
  timestamp: string;
}

export interface UserDisconnectionEvent {
  socketId: string;
  timestamp: string;
}

// ==================== NOTIFICATION RESULT TYPES ====================

export interface NotificationResult {
  success: boolean;
  message?: string;
  error?: string;
  recipients?: number;
}

export interface ConnectionResult {
  success: boolean;
  socketId?: string;
  error?: string;
}

// ==================== NOTIFICATION ROOM TYPES ====================

export interface NotificationRoom {
  roomId: string;
  userId: string;
  socketIds: string[];
  createdAt: Date;
  lastActivity: Date;
}

export interface RoomJoinResult {
  success: boolean;
  roomId: string;
  socketId: string;
  error?: string;
}

// ==================== NOTIFICATION HEALTH TYPES ====================

export interface NotificationHealthStatus {
  status: "healthy" | "unhealthy";
  connected: boolean;
  activeConnections: number;
  activeRooms: number;
  uptime: number;
  lastActivity?: Date;
}

// ==================== NOTIFICATION LOGGING TYPES ====================

export interface NotificationLogEntry {
  timestamp: Date;
  type: "connection" | "disconnection" | "notification" | "error";
  userId?: string;
  socketId: string;
  event?: string;
  message: string;
  data?: any;
}

// ==================== NOTIFICATION MIDDLEWARE TYPES ====================

export interface NotificationMiddleware {
  onConnection?: (socket: Socket) => void;
  onDisconnection?: (socket: Socket) => void;
  onJoinRoom?: (socket: Socket, userId: string) => void;
  onLeaveRoom?: (socket: Socket, userId: string) => void;
}

// ==================== NOTIFICATION BROADCAST TYPES ====================

export interface BroadcastOptions {
  includeSender?: boolean;
  roomId?: string;
  userId?: string;
  event: string;
  data: any;
}

export interface BroadcastResult {
  success: boolean;
  recipients: number;
  error?: string;
}

// ==================== NOTIFICATION RATE LIMITING TYPES ====================

export interface NotificationRateLimit {
  maxNotificationsPerMinute: number;
  maxConnectionsPerUser: number;
  cooldownPeriod: number; // in seconds
}

export interface RateLimitStatus {
  canSend: boolean;
  remainingNotifications: number;
  resetTime: Date;
  isRateLimited: boolean;
}
