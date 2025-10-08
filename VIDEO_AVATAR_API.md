# Video Avatar API Documentation

## Overview

The Video Avatar API provides endpoints for creating and managing AI-generated video avatars. This API follows the existing S3 integration patterns and provides asynchronous avatar generation with callback support.

## Base URL

```
http://localhost:4000/v2
```

## Authentication

All endpoints require an API key in the request header:

```
x-api-key: {API_KEY}
```

## File Upload Support

The API now supports both file uploads and URL-based submissions:

- **File Upload**: Upload MP4 files directly from desktop
- **URL Submission**: Provide URLs to existing videos
- **Mixed Mode**: Combine file uploads with URLs

## Endpoints

### 1. Submit Video Avatar Creation Request

**Endpoint:** `POST /v2/video_avatar`

**Description:** Submit URLs for training footage and consent statement to create a video avatar.

**Headers:**
```
x-api-key: {API_KEY}
Content-Type: application/json
```

**Request Body (Multipart Form Data):**

**Option 1: File Upload**
```
avatar_name: "John Doe"
avatar_group_id: "965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da976"
callback_id: "callback_12345"
callback_url: "https://example.com/webhook"
training_footage: [FILE] (MP4 video file)
consent_statement: [FILE] (MP4 video file)
```

**Option 2: URL Submission**
```json
{
  "training_footage_url": "https://example.com/training-footage.mp4",
  "consent_statement_url": "https://example.com/consent-statement.mp4",
  "avatar_name": "John Doe",
  "avatar_group_id": "965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da976",
  "callback_id": "callback_12345",
  "callback_url": "https://example.com/webhook"
}
```

**Option 3: Mixed Mode**
```
avatar_name: "John Doe"
training_footage: [FILE] (MP4 video file)
consent_statement_url: "https://example.com/consent-statement.mp4"
callback_id: "callback_12345"
```

**Response:** `202 Accepted`
```json
{
  "avatar_id": "avatar_123",
  "avatar_group_id": "965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da976"
}
```

**Field Descriptions:**
- `training_footage_url` (required): URL to training footage video
- `consent_statement_url` (required): URL to consent statement video
- `avatar_name` (required): Name of the avatar
- `avatar_group_id` (optional): Existing Avatar Group ID
- `callback_id` (optional): Unique identifier for callback
- `callback_url` (optional): URL for asynchronous status updates

### 2. Check Video Avatar Generation Status

**Endpoint:** `GET /v2/video_avatar/:id`

**Description:** Check the status of avatar generation.

**Headers:**
```
x-api-key: {API_KEY}
```

**Response:** `200 OK`

**In Progress:**
```json
{
  "status": "in_progress",
  "avatar_id": "avatar_123",
  "avatar_group_id": "965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da976"
}
```

**Completed:**
```json
{
  "avatar_id": "avatar_123",
  "status": "completed",
  "avatar_group_id": "965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da976",
  "avatar_name": "John Doe",
  "completedAt": "2024-01-15T10:30:00.000Z"
}
```

**Failed:**
```json
{
  "avatar_id": "avatar_123",
  "status": "failed",
  "avatar_group_id": "965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da976",
  "error": "Invalid training footage format."
}
```

### 3. Get Avatars by Group (Bonus Endpoint)

**Endpoint:** `GET /v2/video_avatar/group/:groupId`

**Description:** Get all avatars belonging to a specific group.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "avatar_id": "avatar_123",
      "avatar_group_id": "group_456",
      "avatar_name": "John Doe",
      "status": "completed",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "completedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### 4. Delete Video Avatar (Bonus Endpoint)

**Endpoint:** `DELETE /v2/video_avatar/:id`

**Description:** Delete a video avatar.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Avatar deleted successfully"
}
```

### 5. Health Check (Bonus Endpoint)

**Endpoint:** `GET /v2/video_avatar/health`

**Description:** Check the health of the video avatar service.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Video Avatar service is healthy",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Callback Workflow

If a `callback_url` is provided during avatar creation, the system will send a POST request to the specified URL upon completion or failure.

**Callback Payload:**
```json
{
  "avatar_id": "avatar_123",
  "status": "completed",
  "avatar_group_id": "965722cc0ec14873a22698ca3dc24993_e5668fee229e48a1a7a76505395da976",
  "callback_id": "callback_12345"
}
```

## Technical Requirements

### Video URL Requirements

1. **Accessibility:** Must be publicly accessible or authenticated URLs
2. **Format:** .mp4 (H.264 codec preferred)
3. **Resolution:** Minimum 720p
4. **Duration:** Training footage minimum 2 minutes
5. **Content Type:** Must be video/mp4 or similar video format

### Error Handling

**Common Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Missing required fields: training_footage_url, consent_statement_url, and avatar_name are required"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Avatar ID not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Internal server error"
}
```

## S3 Integration

The API follows the existing S3 integration patterns:

- **Service:** Uses the existing `S3Service` class
- **Configuration:** Inherits AWS S3 configuration from environment variables
- **Security:** Maintains the same security patterns as video uploads
- **Storage:** Can be extended to store avatar assets in S3

## Database Schema

The `VideoAvatar` model includes:

```typescript
{
  avatar_id: string;           // Unique identifier
  avatar_group_id: string;     // Group identifier
  avatar_name: string;         // Human-readable name
  training_footage_url: string; // Training video URL
  consent_statement_url: string; // Consent video URL
  status: 'in_progress' | 'completed' | 'failed';
  callback_id?: string;        // Optional callback identifier
  callback_url?: string;       // Optional callback URL
  error?: string;              // Error message if failed
  createdAt: Date;             // Creation timestamp
  updatedAt: Date;             // Last update timestamp
  completedAt?: Date;          // Completion timestamp
}
```

## Testing

Run the test script to verify API functionality:

```bash
node test-video-avatar-api.js
```

Make sure the server is running on `http://localhost:4000` before running tests.

## Implementation Notes

1. **Asynchronous Processing:** Avatar generation is simulated with a 5-second delay
2. **URL Validation:** All video URLs are validated for accessibility and format
3. **Error Handling:** Comprehensive error handling with appropriate HTTP status codes
4. **Callback Support:** Optional callback notifications for status updates
5. **Group Management:** Support for organizing avatars into groups
6. **S3 Ready:** Architecture supports S3 integration for avatar asset storage

## Future Enhancements

- Real avatar generation service integration
- S3 storage for avatar assets
- Advanced video processing validation
- Batch avatar creation
- Avatar template management
- Advanced callback webhook security
