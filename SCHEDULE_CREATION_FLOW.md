# How Schedule Creation Works

## 📋 Overview

When a user creates a video schedule, the system generates a complete schedule with multiple video entries, each with AI-generated content and social media captions.

---

## 🔄 Complete Flow

### Step 1: Request Validation & Setup

**File**: `src/controllers/videoSchedule.controller.ts` → `createSchedule()`

**What happens:**

1. ✅ Validates request body (frequency, schedule, dates, email)
2. ✅ Checks user has active subscription
3. ✅ Gets user email (from request or user settings)
4. ✅ Converts dates from user's timezone to UTC
5. ✅ Calls `createScheduleAsync()`

**Input from user:**

```typescript
{
  frequency: "once_week" | "twice_week" | "three_week" | "daily",
  schedule: {
    days: ["Monday", "Tuesday", ...],  // Days of week
    times: ["09:00", "14:30", ...]     // Times in HH:MM format
  },
  startDate: "2024-01-01",
  endDate: "2024-02-01" (optional - defaults to 1 month)
}
```

---

### Step 2: Schedule Creation Logic

**File**: `src/services/videoSchedule/schedule-creation.service.ts` → `createScheduleAsync()`

**What happens:**

#### 2.1 Validation & Checks

- ✅ Validates schedule data
- ✅ Checks user doesn't already have active schedule
- ✅ Gets user video settings (required)

#### 2.2 Calculate Schedule Duration

```typescript
// Default duration: 1 month from start date
const endDate = new Date(startDate);
endDate.setMonth(endDate.getMonth() + 1); // DEFAULT_SCHEDULE_DURATION_MONTHS = 1
```

#### 2.3 Calculate Number of Videos Needed

```typescript
// Based on frequency and duration
// Examples:
// - once_week for 1 month = ~4 videos
// - twice_week for 1 month = ~8 videos
// - three_week for 1 month = ~12 videos
// - daily for 1 month = ~30 videos
const numberOfVideos = calculateNumberOfVideos(frequency, startDate, endDate);
```

#### 2.4 Generate Real Estate Trends (AI Content)

- Generates unique real estate trend topics using AI
- Filters out trends that user already has videos for (no duplicates)
- Generates in chunks to avoid rate limiting
- Retries if not enough unique trends found

**Each trend contains:**

- `description`: Video title/topic (e.g., "Top 5 Real Estate Investment Strategies")
- `keypoints`: Main talking points for the video

#### 2.5 Create Basic Captions

For each trend, creates basic social media captions:

- `instagram_caption`
- `facebook_caption`
- `linkedin_caption`
- `twitter_caption`
- `tiktok_caption`
- `youtube_caption`

**Note**: These are basic captions. Dynamic captions are generated later in background.

#### 2.6 Schedule Trends with Dates/Times

**File**: `src/services/videoSchedule/utils.service.ts` → `createScheduledTrends()`

For each trend, calculates when it should be posted:

- Based on frequency (once_week, twice_week, etc.)
- Based on schedule days and times
- Skips dates that are too soon (< 40 minutes away)
- Converts to UTC for storage

**Example:**

```typescript
// If frequency is "twice_week" with schedule:
// days: ["Monday", "Wednesday"]
// times: ["09:00", "14:30"]
//
// Creates videos scheduled for:
// - Monday at 09:00
// - Wednesday at 14:30
// - Next Monday at 09:00
// - Next Wednesday at 14:30
// ... until endDate
```

---

### Step 3: Save Schedule to Database

**File**: `src/services/videoSchedule/schedule-creation.service.ts`

**What gets saved in `VideoSchedule` collection:**

```typescript
{
  userId: ObjectId,                    // User who created schedule
  email: string,                       // User's email
  timezone: string,                    // User's timezone (e.g., "America/New_York")
  frequency: "once_week" | ...,        // How often videos are created
  schedule: {
    days: ["Monday", "Wednesday"],      // Days of week
    times: ["09:00", "14:30"]          // Times in HH:MM
  },
  isActive: true,                      // Schedule is active
  status: "processing",                // Initial status (processing → ready)
  startDate: Date,                     // When schedule starts (UTC)
  endDate: Date,                       // When schedule ends (UTC, 1 month later)
  generatedTrends: [                   // Array of scheduled videos
    {
      description: string,              // Video title/topic
      keypoints: string,                // Main talking points
      instagram_caption: string,        // Basic Instagram caption
      facebook_caption: string,          // Basic Facebook caption
      linkedin_caption: string,          // Basic LinkedIn caption
      twitter_caption: string,           // Basic Twitter caption
      tiktok_caption: string,            // Basic TikTok caption
      youtube_caption: string,            // Basic YouTube caption
      scheduledFor: Date,                // When this video should be created (UTC)
      status: "pending",                 // Initial status (pending → processing → completed)
      videoId: undefined,                // Will be set when video is created
      enhanced_with_dynamic_posts: false, // Will be true after dynamic captions generated
      caption_status: "pending",         // Caption generation status
      caption_processed_at: undefined,  // When captions were generated
      caption_error: undefined           // Error if caption generation failed
    },
    // ... more trends (one for each scheduled video)
  ],
  createdAt: Date,
  updatedAt: Date
}
```

---

### Step 4: Post-Creation Actions

#### 4.1 Send WebSocket Notification

```typescript
notificationService.notifyScheduleStatus(userId, "processing", {
  scheduleId: schedule._id.toString(),
  message: "Schedule creation started",
  totalVideos: numberOfVideos,
  processedVideos: 0,
});
```

#### 4.2 Send Email Notification

Sends email to user with:

- Schedule details (frequency, dates, timezone)
- Total number of videos
- List of upcoming videos (first 5)
- What happens next

#### 4.3 Queue Background Caption Generation

**File**: `src/services/videoSchedule/caption-generation.service.ts`

Queues background job to generate **dynamic captions** for all videos:

- Uses AI to create platform-specific captions
- Enhances basic captions with user context (name, company, etc.)
- Updates `generatedTrends` with enhanced captions
- Updates `caption_status` to "ready" when done
- Updates schedule `status` to "ready" when all captions are done

**This happens asynchronously** - schedule is created immediately, captions generated in background.

---

## 📊 What Gets Added to Database

### 1. **VideoSchedule Document** (1 record)

Contains:

- Schedule metadata (frequency, dates, timezone)
- Array of `generatedTrends` (one per scheduled video)
- Status tracking

### 2. **Generated Trends Array** (N records, where N = number of videos)

Each trend in `generatedTrends` array contains:

- ✅ Video content (description, keypoints)
- ✅ Basic social media captions (6 platforms)
- ✅ Scheduled date/time (`scheduledFor`)
- ✅ Status tracking (`status`, `caption_status`)
- ✅ Video ID (set later when video is created)

**Example for "twice_week" frequency:**

- If schedule runs for 1 month (4 weeks)
- Creates ~8 videos (2 per week × 4 weeks)
- Each video has its own entry in `generatedTrends` array

---

## 🎯 Key Points

### What Happens Immediately:

1. ✅ Schedule document created in database
2. ✅ All trends generated and scheduled
3. ✅ Basic captions created for all videos
4. ✅ WebSocket notification sent
5. ✅ Email sent to user
6. ✅ Background caption generation queued

### What Happens Later (Background):

1. 🔄 Dynamic captions generated (enhanced with AI)
2. 🔄 Schedule status updated to "ready" when captions done
3. 🔄 Videos created automatically 30 minutes before scheduled time
4. 🔄 Videos posted to social media automatically

---

## 📝 Example: Creating a Schedule

### User Input:

```json
{
  "frequency": "twice_week",
  "schedule": {
    "days": ["Monday", "Wednesday"],
    "times": ["09:00", "14:30"]
  },
  "startDate": "2024-01-01",
  "timezone": "America/New_York"
}
```

### What Gets Created:

**VideoSchedule Document:**

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "timezone": "America/New_York",
  "frequency": "twice_week",
  "schedule": {
    "days": ["Monday", "Wednesday"],
    "times": ["09:00", "14:30"]
  },
  "isActive": true,
  "status": "processing",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-02-01T00:00:00.000Z",
  "generatedTrends": [
    {
      "description": "Top 5 Real Estate Investment Strategies for 2024",
      "keypoints": "1. Location analysis 2. Market trends 3. ROI calculation",
      "instagram_caption": "🏠 Top 5 Real Estate Investment Strategies...",
      "facebook_caption": "Discover the top 5 real estate investment...",
      "linkedin_caption": "As we enter 2024, real estate investment...",
      "twitter_caption": "Top 5 Real Estate Investment Strategies 🏠...",
      "tiktok_caption": "POV: You're learning about real estate...",
      "youtube_caption": "In this video, we'll explore the top 5...",
      "scheduledFor": "2024-01-01T14:00:00.000Z", // Monday 09:00 EST = 14:00 UTC
      "status": "pending",
      "caption_status": "pending"
    },
    {
      "description": "How to Find the Best Real Estate Deals",
      "keypoints": "1. Networking 2. Market research 3. Negotiation",
      "instagram_caption": "💡 How to Find the Best Real Estate Deals...",
      // ... more captions
      "scheduledFor": "2024-01-03T19:30:00.000Z", // Wednesday 14:30 EST = 19:30 UTC
      "status": "pending",
      "caption_status": "pending"
    }
    // ... 6 more videos (total 8 for 1 month)
  ]
}
```

**Total:**

- 1 VideoSchedule document
- 8 generatedTrends entries (one per scheduled video)
- Each trend has 6 social media captions = 48 captions total
- All scheduled with specific dates/times

---

## 🔄 Status Flow

### Schedule Status:

1. `"processing"` → Initial status when created
2. `"ready"` → When all dynamic captions are generated
3. `"failed"` → If caption generation fails

### Individual Video Status (in generatedTrends):

1. `"pending"` → Initial status, waiting to be created
2. `"processing"` → Video is being created (30 min before scheduled time)
3. `"completed"` → Video created successfully
4. `"failed"` → Video creation failed

### Caption Status:

1. `"pending"` → Basic captions only, waiting for dynamic generation
2. `"ready"` → Dynamic captions generated successfully
3. `"failed"` → Dynamic caption generation failed

---

## ⚙️ Configuration Constants

**File**: `src/constants/videoScheduleService.constants.ts`

- `DEFAULT_SCHEDULE_DURATION_MONTHS = 1` (schedule runs for 1 month)
- `CHUNK_SIZE = 10` (generate trends in chunks of 10)
- `MAX_ATTEMPTS = 5` (retry up to 5 times if not enough trends)
- `CHUNK_DELAY_MS = 1000` (1 second delay between chunks)

---

## 🎯 Summary

**When a schedule is created, the system:**

1. ✅ **Generates** unique real estate trends (AI-powered)
2. ✅ **Creates** basic social media captions for all platforms
3. ✅ **Schedules** each video with specific date/time
4. ✅ **Saves** everything to database in one VideoSchedule document
5. ✅ **Sends** notifications (WebSocket + Email)
6. ✅ **Queues** background job for dynamic caption generation
7. ✅ **Returns** immediately with "processing" status

**The schedule is ready to use immediately**, but dynamic captions are enhanced in the background. Videos are created automatically 30 minutes before each scheduled time.
