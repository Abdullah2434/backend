# Auto-Posting to SocialBu - How It Works

## ✅ **YES, Videos Are Automatically Posted to SocialBu**

After a scheduled video is generated and ready, it is **automatically posted** to all connected social media accounts via SocialBu.

---

## 🔄 Complete Auto-Posting Flow

### Step 1: Video Generation (30 minutes before scheduled time)

**File**: `src/cron/processScheduledVideos.ts`

- Cron job runs every minute
- Checks for videos scheduled in the next 30 minutes
- Calls video generation API
- Video status: `pending` → `processing`

### Step 2: Video Completion Webhook

**File**: `src/services/webhook/webhook.service.ts` → `handleScheduledVideoCompletion()`

When video generation completes, webhook is called with:

- `videoId`
- `status: "ready"`
- `scheduleId`
- `trendIndex`

### Step 3: Auto-Post Trigger

**File**: `src/services/webhook/webhook.service.ts` → `autoPostScheduledVideo()`

**What happens:**

1. ✅ Updates schedule status to `completed`
2. ✅ Stores captions from schedule to video
3. ✅ Calls `AutoSocialPostingService.postVideoToSocialMedia()`

### Step 4: Auto-Posting Process

**File**: `src/services/autoSocialPosting.service.ts` → `postVideoToSocialMedia()`

**Step-by-step:**

#### 4.1 Pre-flight Checks

```typescript
// Check 1: Active SocialBu token exists
const activeToken = await SocialBuToken.findOne({ isActive: true });
if (!activeToken) {
  // Send failure notification
  return [];
}

// Check 2: User has connected social media accounts
const connectedAccounts = await UserConnectedAccount.find({
  userId: data.userId,
  isActive: true,
});
if (connectedAccounts.length === 0) {
  // Send failure notification
  return [];
}
```

#### 4.2 Upload Video to SocialBu

```typescript
// Upload video to SocialBu media service
const uploadResult = await socialBuMediaService.uploadMedia(userId, {
  name: videoTitle + ".mp4",
  mime_type: "video/mp4",
  videoUrl: videoUrl,
});

// Wait 2 seconds for processing
await new Promise((resolve) => setTimeout(resolve, 2000));

// Get upload_token from SocialBu
const statusResponse = await socialBuService.makeAuthenticatedRequest(
  "GET",
  `/upload_media/status?key=${key}`
);
const uploadToken = statusResponse.data?.upload_token;
```

#### 4.3 Post to Each Connected Platform

```typescript
// For each connected account (Instagram, Facebook, LinkedIn, etc.)
for (const account of connectedAccounts) {
  // Get platform-specific caption from schedule
  const caption = getPlatformCaption(trend, account.platform);

  // Create post via SocialBu API
  const postResponse = await socialBuService.makeAuthenticatedRequest(
    "POST",
    "/posts",
    {
      accounts: [account.socialbuAccountId],
      media: uploadToken,
      caption: caption,
      // ... other post data
    }
  );
}
```

#### 4.4 Send Notifications

- ✅ Success notification if all platforms succeed
- ⚠️ Partial success notification if some platforms fail
- ❌ Failure notification if all platforms fail

---

## 📋 Requirements for Auto-Posting

### ✅ **Must Have:**

1. **Active SocialBu Token**

   - Must have an active token in `SocialBuToken` collection
   - Token must have `isActive: true`

2. **Connected Social Media Accounts**

   - User must have at least one connected account in `UserConnectedAccount`
   - Account must have `isActive: true`
   - Account must have valid `socialbuAccountId`

3. **Video Status = "ready"**

   - Video must be successfully generated
   - Webhook must receive `status: "ready"`

4. **Schedule Captions**
   - Schedule must have captions for the platforms being posted to
   - Captions are stored in `generatedTrends[trendIndex]`

---

## 🎯 What Gets Posted

### For Each Connected Account:

1. **Video File**

   - Uploaded to SocialBu media service
   - Gets `upload_token` from SocialBu

2. **Platform-Specific Caption**

   - Instagram → `trend.instagram_caption`
   - Facebook → `trend.facebook_caption`
   - LinkedIn → `trend.linkedin_caption`
   - Twitter → `trend.twitter_caption`
   - TikTok → `trend.tiktok_caption`
   - YouTube → `trend.youtube_caption`

3. **Post Metadata**
   - Video title
   - Schedule ID
   - Trend index

---

## 🔄 Complete Timeline

```
Time: Scheduled Time - 30 minutes
├─ Cron job detects upcoming video
├─ Calls video generation API
└─ Video status: processing

Time: Scheduled Time (or when video ready)
├─ Video generation completes
├─ Webhook receives "ready" status
├─ Auto-post triggered
│  ├─ Upload video to SocialBu
│  ├─ Get upload_token
│  ├─ Post to Instagram (if connected)
│  ├─ Post to Facebook (if connected)
│  ├─ Post to LinkedIn (if connected)
│  ├─ Post to Twitter (if connected)
│  ├─ Post to TikTok (if connected)
│  └─ Post to YouTube (if connected)
└─ Send notifications (success/partial/failure)
```

---

## ⚠️ Error Handling

### If Auto-Post Fails:

1. **No Active Token**

   - Sends failure notification
   - Does NOT fail the webhook
   - Video is still marked as `completed` in schedule

2. **No Connected Accounts**

   - Sends failure notification
   - Does NOT fail the webhook
   - Video is still marked as `completed` in schedule

3. **Upload Fails**

   - Sends failure notification
   - Does NOT fail the webhook
   - Video is still marked as `completed` in schedule

4. **Some Platforms Fail**
   - Sends partial success notification
   - Lists which platforms succeeded/failed
   - Does NOT fail the webhook

**Key Point:** Auto-posting failures do NOT prevent the video from being marked as completed. The system is designed to be resilient.

---

## 📊 Notification Types

### Success Notification

```typescript
{
  type: "success",
  message: "Auto-post completed successfully!",
  platforms: ["Instagram", "Facebook", "LinkedIn"],
  videoTitle: "..."
}
```

### Partial Success Notification

```typescript
{
  type: "partial",
  message: "Auto-post completed with some failures",
  successfulPlatforms: ["Instagram", "Facebook"],
  failedPlatforms: ["Twitter"],
  videoTitle: "..."
}
```

### Failure Notification

```typescript
{
  type: "failure",
  message: "Auto-post failed!",
  errorDetails: "No connected social media accounts",
  videoTitle: "..."
}
```

---

## 🔍 Code Locations

### Main Auto-Posting Service

- **File**: `src/services/autoSocialPosting.service.ts`
- **Class**: `AutoSocialPostingService`
- **Method**: `postVideoToSocialMedia()`

### Webhook Handler

- **File**: `src/services/webhook/webhook.service.ts`
- **Method**: `handleScheduledVideoCompletion()`
- **Method**: `autoPostScheduledVideo()`

### Video Controller Helper

- **File**: `src/utils/videoControllerHelpers.ts`
- **Method**: `handleScheduleAutoPosting()`

---

## ✅ Summary

**YES, videos are automatically posted to SocialBu** when:

1. ✅ Video is successfully generated (status = "ready")
2. ✅ User has connected social media accounts
3. ✅ Active SocialBu token exists
4. ✅ Schedule has captions for the platforms

**The posting happens automatically** - no manual action required from the user!

**If any of the requirements are missing**, the system:

- Still marks the video as `completed` in the schedule
- Sends a failure notification to the user
- Does NOT fail the webhook or video generation
