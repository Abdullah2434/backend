import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

class NotificationService {
  private io: SocketIOServer | null = null;

  initialize(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "https://www.edgeairealty.com",
        methods: ["GET", "POST"]
      }
    });

    this.io.on('connection', (socket: Socket) => {
      console.log('User connected:', socket.id);
      
      socket.on('join-room', (userId: string) => {
        socket.join(`user-${userId}`);
        console.log(`User ${userId} joined room`);
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
      });
    });
  }

  notifyUser(userId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`user-${userId}`).emit(event, data);
      console.log(`Notification sent to user ${userId}:`, event, data);
    }
  }

  notifyPhotoAvatarProgress(userId: string, step: string, status: 'progress' | 'success' | 'error', data?: any) {
    this.notifyUser(userId, 'photo-avatar-update', {
      step,
      status,
      data,
      timestamp: new Date().toISOString()
    });
  }

  notifyVideoDownloadProgress(userId: string, step: string, status: 'progress' | 'success' | 'error', data?: any) {
    this.notifyUser(userId, 'video-download-update', {
      step,
      status,
      data,
      timestamp: new Date().toISOString()
    });
  }
}

export const notificationService = new NotificationService();
