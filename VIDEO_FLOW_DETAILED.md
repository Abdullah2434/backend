# Video Flow - Detailed Explanation 🎬

## Overview

The video processing system is a complex workflow that involves multiple stages, external services, webhooks, and real-time notifications. Here's the complete flow breakdown:

---

## 🎯 **Video Flow Architecture**

### **1. Video Creation Entry Points**

#### **A. Direct Video Creation** (`/api/video/create`)

```typescript
POST /api/video/create
{
  "prompt": "string",
  "avatar": ["string"],
  "name": "string",
  "position": "string",
  "companyName": "string",
  "license": "string",
  "tailoredFit": "string",
  "socialHandles": "string",
  "videoTopic": "string",
  "topicKeyPoints": "string",
  "city": "string",
  "preferredTone": "string",
  "callToAction": "string",
  "email": "string"
}
```

#### **B. Video Generation** (`/api/video/generate-video`)

```typescript
POST /api/video/generate-video
{
  "hook": "string",
  "body": "string",
  "conclusion": "string",
  "company_name": "string",
  "social_handles": "string",
  "license": "string",
  "avatar_title": "string",
  "avatar_body": "string",
  "avatar_conclusion": "string",
  "email": "string",
  "title": "string"
}
```

---

## 🔄 **Complete Video Processing Flow**

### **Phase 1: Video Request Initiation**

1. **User Submits Video Request**

   - Frontend sends video creation data to backend
   - Backend validates all required fields
   - Creates unique request ID: `video_${timestamp}_${random}`

2. **Webhook Dispatch**

   - **Create Video**: Sends to `VIDEO_CREATION_WEBHOOK_URL`
   - **Generate Video**: Sends to `GENERATE_VIDEO_WEBHOOK_URL` (n8n)
   - Both use "fire and forget" pattern (async processing)

3. **Initial Response**
   ```json
   {
     "success": true,
     "message": "Video generation started successfully",
     "data": {
       "status": "processing",
       "timestamp": "2025-10-02T13:29:00.638Z",
       "estimated_completion": "2025-10-02T13:44:00.638Z",
       "note": "Video generation is running in the background"
     }
   }
   ```

### **Phase 2: External Processing**

4. **External Service Processing**

   - Video creation service (n8n workflow) processes the request
   - Generates video using AI avatars, voices, and content
   - Processing time: ~15 minutes (estimated)

5. **Avatar & Voice Matching**

   ```typescript
   // System automatically matches voice to avatar gender
   const avatarDoc = await DefaultAvatar.findOne({
     avatar_id: request.avatar_title,
   });
   const gender = avatarDoc?.gender;

   if (gender) {
     const voiceDoc = await DefaultVoice.findOne({ gender });
     voice_id = voiceDoc?.voice_id;
   }
   ```

### **Phase 3: Video Completion & Download**

6. **Video Completion Webhook** (`/api/webhook/video-complete`)

   ```typescript
   POST /api/webhook/video-complete
   {
     "videoId": "string",
     "status": "ready" | "failed",
     "s3Key": "string",
     "metadata": { "size": number, "format": "mp4" },
     "error": "string" // if failed
   }
   ```

7. **Video Download & Upload**

   - Downloads video from external service URL
   - Uploads to AWS S3 with key: `videos/${userId}/${timestamp}.mp4`
   - Creates video record in database

8. **Database Record Creation**
   ```typescript
   const video = new VideoModel({
     videoId: `${user._id}_${timestamp}`,
     userId: user._id,
     title: request.title,
     status: "ready",
     s3Key: s3Key,
     metadata: {
       size: videoBuffer.length,
       originalUrl: videoUrl,
     },
   });
   ```

### **Phase 4: Workflow Tracking & Notifications**

9. **Workflow History Update**

   ```typescript
   await WorkflowHistory.findOneAndUpdate(
     { executionId },
     {
       status: "completed",
       completedAt: new Date(),
     }
   );
   ```

10. **Real-time Notifications**
    - **Progress Notification**: "Starting video download..."
    - **Success Notification**: "Video downloaded and uploaded successfully!"
    - **Error Notification**: "Video creation failed. Please try again."

---

## 📊 **Video Status Lifecycle**

### **Status Flow:**

```
pending → processing → ready
   ↓         ↓          ↓
failed ← processing ← ready
```

### **Status Definitions:**

- **`pending`**: Request submitted, waiting for processing
- **`processing`**: Video generation in progress
- **`ready`**: Video completed and available for download
- **`failed`**: Video generation failed

---

## 🔧 **Key Components**

### **1. Video Generation Service**

```typescript
class VideoGenerationService {
  async createVideo(request: VideoGenerationRequest): Promise<any>;
  async generateVideo(request: GenerateVideoRequest): Promise<void>;
  private async sendWebhookRequest(webhookUrl: string, data: any): Promise<any>;
  private async sendWebhookRequestFireAndForget(
    webhookUrl: string,
    data: any
  ): void;
}
```

### **2. Video Service**

```typescript
class VideoService {
  async getUserVideosWithDownloadUrls(userId: string): Promise<Video[]>;
  async getVideo(videoId: string): Promise<any>;
  async updateVideoStatus(videoId: string, status: string): Promise<any>;
  async updateVideoMetadata(videoId: string, metadata: any): Promise<any>;
  async downloadAndUploadVideo(request: DownloadVideoRequest): Promise<any>;
  async deleteVideo(videoId: string): Promise<boolean>;
}
```

### **3. Video Storage Service**

```typescript
class VideoStorageService {
  async downloadFromUrl(videoUrl: string): Promise<Buffer>;
  async uploadVideo(
    buffer: Buffer,
    s3Key: string,
    contentType: string
  ): Promise<void>;
  async getDownloadUrl(s3Key: string): Promise<string>;
  async deleteVideo(s3Key: string): Promise<void>;
}
```

---

## 🎛️ **API Endpoints**

### **Video Creation & Generation**

- `POST /api/video/create` - Create video via webhook
- `POST /api/video/generate-video` - Generate video via n8n
- `POST /api/video/download-video` - Download and upload video

### **Video Management**

- `GET /api/video/gallery` - Get user's video gallery
- `GET /api/video/status/:videoId` - Get video status
- `DELETE /api/video/delete/:videoId` - Delete video
- `GET /api/video/download/:videoId` - Download video

### **Resources**

- `GET /api/video/avatars` - Get available avatars
- `GET /api/video/voices` - Get available voices
- `GET /api/video/topics` - Get video topics

### **Webhooks**

- `POST /api/webhook/video-complete` - Video completion webhook
- `POST /api/webhook/workflow-error` - Workflow error webhook

---

## 🔄 **Webhook Flow**

### **1. Video Completion Webhook**

```typescript
// External service calls this when video is ready
POST /api/webhook/video-complete
{
  "videoId": "user123_1640995200000",
  "status": "ready",
  "s3Key": "videos/user123/1640995200000.mp4",
  "metadata": {
    "size": 15728640,
    "format": "mp4",
    "duration": 30
  }
}
```

### **2. Workflow Error Webhook**

```typescript
// External service calls this when processing fails
POST /api/webhook/workflow-error
{
  "errorMessage": "Avatar generation failed",
  "executionId": "exec_123456789"
}
```

---

## 📱 **Real-time Notifications**

### **Notification Types:**

1. **Video Download Progress**

   ```typescript
   notificationService.notifyVideoDownloadProgress(
     userId,
     "download",
     "progress",
     { message: "Starting video download..." }
   );
   ```

2. **Video Completion**

   ```typescript
   notificationService.notifyVideoDownloadProgress(
     userId,
     "complete",
     "success",
     {
       message: "Video downloaded and uploaded successfully!",
       videoId: result.videoId,
       title: result.title,
       size: result.size,
     }
   );
   ```

3. **Error Notifications**
   ```typescript
   notificationService.notifyUser(userId, "video-download-update", {
     type: "error",
     status: "error",
     message: "Video creation failed. Please try again.",
     timestamp: new Date().toISOString(),
   });
   ```

---

## 🗄️ **Database Models**

### **Video Model**

```typescript
interface Video {
  _id: string;
  videoId: string; // Unique video identifier
  userId: string; // User who created the video
  title: string; // Video title
  status: "processing" | "ready" | "failed";
  downloadUrl?: string; // S3 download URL
  videoUrl?: string; // Alternative video URL
  s3Key?: string; // S3 storage key
  metadata?: VideoMetadata; // Video metadata
  createdAt: Date;
  updatedAt: Date;
}
```

### **Workflow History Model**

```typescript
interface WorkflowHistoryEntry {
  executionId: string; // External execution ID
  userId: string; // User ID
  email: string; // User email
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}
```

---

## 🚀 **Performance Optimizations**

### **1. Async Processing**

- Webhook calls are "fire and forget"
- No blocking operations during video generation
- Background processing for heavy operations

### **2. S3 Storage**

- Videos stored in S3 for scalability
- Signed URLs for secure downloads
- Automatic cleanup of temporary files

### **3. Database Indexing**

- Indexed on `userId` for fast user video queries
- Indexed on `videoId` for quick video lookups
- Indexed on `status` for status-based queries

---

## 🔒 **Security & Validation**

### **1. Input Validation**

- All required fields validated before processing
- Email format validation
- File type validation for uploads

### **2. User Authentication**

- Protected routes require authentication
- User can only access their own videos
- S3 URLs are signed and time-limited

### **3. Error Handling**

- Comprehensive error catching and logging
- User-friendly error messages
- Graceful degradation on failures

---

## 📈 **Monitoring & Analytics**

### **1. Video Statistics**

- Total videos created
- Success/failure rates
- Processing times
- Storage usage

### **2. Workflow Tracking**

- Execution ID tracking
- Status monitoring
- Error logging and reporting

### **3. Performance Metrics**

- Webhook response times
- S3 upload/download speeds
- Database query performance

---

This video flow system provides a robust, scalable solution for AI-powered video generation with real-time updates, comprehensive error handling, and efficient storage management.
