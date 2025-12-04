# EdgeAI Backend

Express.js backend with TypeScript, providing a comprehensive API for video generation, social media management, subscriptions, and more.

## 🚀 Features

- **Video Generation**: Create and manage AI-generated videos with avatars and voices
- **Video Scheduling**: Automated video creation and posting schedules
- **Social Media Integration**: Connect and manage multiple social media accounts via SocialBu
- **Subscription Management**: Stripe integration for subscription plans and billing
- **Queue System**: BullMQ-based background job processing for async tasks
- **Real-time Notifications**: WebSocket support for live progress updates
- **Dynamic Content Generation**: AI-powered caption and post generation
- **Cron Jobs**: Automated tasks for avatar sync, subscription sync, and scheduled videos

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- MongoDB database
- Redis server (for queue system)
- AWS S3 account (for file storage)
- Stripe account (for payments)
- HeyGen API key (for video avatars)
- ElevenLabs API key (for text-to-speech)
- OpenAI API key (for content generation)
- SocialBu API credentials (for social media integration)

## 🛠️ Setup

1. **Install dependencies:**

```bash
cd backend
npm install
# or
yarn install
```

2. **Copy environment variables:**

```bash
cp env.example .env
```

3. **Configure your environment variables in `.env`** (see Environment Variables section)

4. **Start Redis server:**

```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis

# Or use Docker
docker run -d -p 6379:6379 redis
```

5. **Run the development server:**

```bash
npm run dev
```

The server will start on `http://localhost:4000`

## 📚 API Endpoints

All endpoints are available under `/api` prefix.

### Authentication (`/api/auth`)

| Method | Endpoint                    | Description                     | Auth Required |
| ------ | --------------------------- | ------------------------------- | ------------- |
| POST   | `/register`                 | User registration               | No            |
| POST   | `/login`                    | User login                      | No            |
| GET    | `/me`                       | Get current user                | Yes           |
| PUT    | `/profile`                  | Update user profile             | Yes           |
| POST   | `/logout`                   | User logout                     | Yes           |
| POST   | `/forgot-password`          | Request password reset          | No            |
| POST   | `/reset-password`           | Reset password with token       | No            |
| POST   | `/validate-reset-token`     | Validate reset token            | No            |
| GET    | `/verify-email`             | Verify email with token         | No            |
| POST   | `/resend-verification`      | Resend verification email       | No            |
| GET    | `/check-email`              | Check if email exists           | No            |
| POST   | `/check-email-verification` | Check email verification status | No            |
| POST   | `/validate-token`           | Validate JWT token              | No            |
| POST   | `/google`                   | Google OAuth login              | No            |
| POST   | `/clear-expired-tokens`     | Clear expired tokens            | Yes           |

### Video Management (`/api/video`)

| Method | Endpoint                     | Description              | Auth Required |
| ------ | ---------------------------- | ------------------------ | ------------- |
| GET    | `/gallery`                   | Get user's video gallery | Yes           |
| POST   | `/create`                    | Create video via webhook | No            |
| POST   | `/generate-video`            | Generate video           | No            |
| POST   | `/delete`                    | Delete video (legacy)    | Yes           |
| DELETE | `/delete/:videoId`           | Delete video by ID       | Yes           |
| DELETE | `/:videoId`                  | Delete video (RESTful)   | Yes           |
| PUT    | `/:videoId/note`             | Update video note        | Yes           |
| GET    | `/download-proxy`            | Proxy video download     | Yes           |
| POST   | `/download`                  | Download video from URL  | No            |
| POST   | `/status`                    | Update video status      | No            |
| POST   | `/mute`                      | Mute video               | No            |
| GET    | `/avatars`                   | Get available avatars    | Yes           |
| GET    | `/voices`                    | Get available voices     | Yes           |
| POST   | `/photo-avatar`              | Create photo avatar      | Yes           |
| GET    | `/pending-workflows/:userId` | Check pending workflows  | Yes           |
| GET    | `/topics`                    | Get all topics           | No            |
| GET    | `/topics/id/:id`             | Get topic by ID          | No            |
| GET    | `/topics/:topic`             | Get topic by type        | No            |
| POST   | `/track-execution`           | Track execution          | No            |

### Video Avatar V2 (`/api/v2/video_avatar`)

| Method | Endpoint                     | Description                          | Auth Required |
| ------ | ---------------------------- | ------------------------------------ | ------------- |
| POST   | `/video_avatar`              | Create video avatar with file upload | Yes           |
| GET    | `/video_avatar/:id`          | Get avatar generation status         | No            |
| GET    | `/video_avatar/health`       | Health check                         | No            |
| GET    | `/video_avatar/proxy/:s3Key` | Proxy video file                     | No            |

### Video Scheduling (`/api/video-schedule`)

| Method | Endpoint                | Description             | Auth Required |
| ------ | ----------------------- | ----------------------- | ------------- |
| POST   | `/schedule`             | Create video schedule   | Yes           |
| GET    | `/schedule`             | Get user's schedule     | Yes           |
| GET    | `/schedule/details`     | Get schedule details    | Yes           |
| GET    | `/schedule/stats`       | Get schedule statistics | Yes           |
| PUT    | `/schedule/:scheduleId` | Update schedule         | Yes           |
| DELETE | `/schedule/:scheduleId` | Deactivate schedule     | Yes           |

### Schedule Posts (`/api/schedule`)

| Method | Endpoint                    | Description                | Auth Required |
| ------ | --------------------------- | -------------------------- | ------------- |
| GET    | `/`                         | Get pending schedule posts | Yes           |
| GET    | `/:scheduleId/post/:postId` | Get schedule post          | Yes           |
| PUT    | `/:scheduleId/post/:postId` | Edit schedule post         | Yes           |
| DELETE | `/:scheduleId/post/:postId` | Delete schedule post       | Yes           |
| DELETE | `/:scheduleId`              | Delete entire schedule     | Yes           |

### Subscriptions (`/api/subscription`)

| Method | Endpoint                     | Description                   | Auth Required |
| ------ | ---------------------------- | ----------------------------- | ------------- |
| GET    | `/plans`                     | Get all subscription plans    | No            |
| GET    | `/current`                   | Get current subscription      | No            |
| POST   | `/create`                    | Create subscription           | Yes           |
| POST   | `/cancel`                    | Cancel subscription           | Yes           |
| POST   | `/reactivate`                | Reactivate subscription       | Yes           |
| GET    | `/payment-methods`           | Get payment methods           | Yes           |
| GET    | `/video-limit`               | Check video limit             | Yes           |
| POST   | `/payment-intent`            | Create payment intent         | Yes           |
| POST   | `/confirm-payment-intent`    | Confirm payment intent        | Yes           |
| GET    | `/payment-intent/:id/status` | Get payment intent status     | Yes           |
| POST   | `/change-plan`               | Change subscription plan      | Yes           |
| GET    | `/plan-change-options`       | Get plan change options       | Yes           |
| GET    | `/billing-history`           | Get billing history           | Yes           |
| GET    | `/billing-summary`           | Get billing summary           | Yes           |
| POST   | `/sync-from-stripe`          | Sync subscription from Stripe | Yes           |
| POST   | `/auto-sync-on-success`      | Auto-sync on payment success  | No            |
| POST   | `/debug-webhook`             | Debug webhook                 | No            |

### Payment Methods (`/api/payment-methods`)

| Method | Endpoint                        | Description                | Auth Required |
| ------ | ------------------------------- | -------------------------- | ------------- |
| GET    | `/`                             | Get payment methods        | Yes           |
| POST   | `/setup-intent`                 | Create setup intent        | Yes           |
| POST   | `/update`                       | Update payment method      | Yes           |
| POST   | `/:paymentMethodId/set-default` | Set default payment method | Yes           |
| DELETE | `/:paymentMethodId`             | Remove payment method      | Yes           |

### Social Media - SocialBu (`/api/socialbu`)

| Method | Endpoint            | Description              | Auth Required |
| ------ | ------------------- | ------------------------ | ------------- |
| POST   | `/login`            | Manual login             | No            |
| POST   | `/save-token`       | Save token manually      | No            |
| GET    | `/accounts`         | Get accounts (protected) | Yes           |
| GET    | `/accounts/public`  | Get accounts (public)    | No            |
| POST   | `/accounts/connect` | Connect account          | No            |
| POST   | `/posts`            | Get posts                | Yes           |
| POST   | `/top/posts`        | Get insights             | Yes           |
| POST   | `/posts/scheduled`  | Get scheduled posts      | Yes           |
| GET    | `/test`             | Test connection          | No            |
| GET    | `/test-auth`        | Test authentication      | Yes           |

### Social Media - Accounts (`/api/socialbu-account`)

| Method | Endpoint            | Description               | Auth Required |
| ------ | ------------------- | ------------------------- | ------------- |
| DELETE | `/:accountId`       | Disconnect account        | Yes           |
| GET    | `/:accountId/check` | Check if user has account | Yes           |

### Social Media - Media (`/api/socialbu-media`)

| Method | Endpoint           | Description              | Auth Required |
| ------ | ------------------ | ------------------------ | ------------- |
| POST   | `/upload`          | Upload media             | Yes           |
| POST   | `/create-post`     | Create social media post | Yes           |
| GET    | `/user-media`      | Get user's media         | Yes           |
| GET    | `/:mediaId`        | Get media by ID          | Yes           |
| PUT    | `/:mediaId/status` | Update media status      | Yes           |

### User Settings (`/api/user-settings`)

| Method | Endpoint         | Description              | Auth Required |
| ------ | ---------------- | ------------------------ | ------------- |
| GET    | `/user-settings` | Get user video settings  | Yes           |
| POST   | `/user-settings` | Save user video settings | Yes           |

### User Connected Accounts (`/api/user-connected-accounts`)

| Method | Endpoint                         | Description                 | Auth Required |
| ------ | -------------------------------- | --------------------------- | ------------- |
| GET    | `/`                              | Get user connected accounts | Yes           |
| GET    | `/type/:type`                    | Get accounts by type        | Yes           |
| GET    | `/stats`                         | Get account statistics      | Yes           |
| POST   | `/sync`                          | Sync connected accounts     | Yes           |
| PUT    | `/:socialbuAccountId/deactivate` | Deactivate account          | Yes           |
| DELETE | `/:socialbuAccountId`            | Delete account              | Yes           |
| PUT    | `/:socialbuAccountId/last-used`  | Update last used            | Yes           |

### Trends (`/api/trends`)

| Method | Endpoint       | Description                       | Auth Required |
| ------ | -------------- | --------------------------------- | ------------- |
| GET    | `/real-estate` | Get real estate trends            | Yes           |
| POST   | `/city`        | Get city-based trends             | Yes           |
| POST   | `/description` | Generate content from description | Yes           |

### Dynamic Posts (`/api/v2/dynamic-posts`)

| Method | Endpoint     | Description            | Auth Required |
| ------ | ------------ | ---------------------- | ------------- |
| POST   | `/generate`  | Generate dynamic posts | Yes           |
| GET    | `/history`   | Get post history       | Yes           |
| GET    | `/analytics` | Get post analytics     | Yes           |
| GET    | `/templates` | Get templates          | No            |
| POST   | `/test`      | Test dynamic posts     | No            |

### Music (`/api/music`)

| Method | Endpoint                  | Description            | Auth Required |
| ------ | ------------------------- | ---------------------- | ------------- |
| GET    | `/tracks`                 | Get all music tracks   | No            |
| GET    | `/tracks/:energyCategory` | Get tracks by energy   | No            |
| GET    | `/track/:trackId`         | Get track by ID        | No            |
| GET    | `/track/:trackId/preview` | Stream music preview   | No            |
| GET    | `/stats`                  | Get music tracks stats | No            |
| POST   | `/upload`                 | Upload music track     | Yes           |
| DELETE | `/track/:trackId`         | Delete music track     | Yes           |

### ElevenLabs (`/api/elevenlabs`)

| Method | Endpoint            | Description      | Auth Required |
| ------ | ------------------- | ---------------- | ------------- |
| GET    | `/voices`           | Get voices       | No            |
| GET    | `/voices/:voice_id` | Get voice by ID  | No            |
| POST   | `/text-to-speech`   | Text to speech   | No            |
| POST   | `/sync-voices`      | Sync voices      | No            |
| POST   | `/voices/add`       | Add custom voice | Yes           |

### Energy Profile (`/api/energy-profile`)

| Method | Endpoint   | Description               | Auth Required |
| ------ | ---------- | ------------------------- | ------------- |
| POST   | `/preset`  | Set preset profile        | Yes           |
| POST   | `/custom`  | Set custom voice/music    | Yes           |
| GET    | `/current` | Get current profile       | Yes           |
| GET    | `/presets` | Get preset configurations | Yes           |

### Webhooks (`/api/webhook`)

| Method | Endpoint                           | Description                  | Auth Required |
| ------ | ---------------------------------- | ---------------------------- | ------------- |
| POST   | `/video-complete`                  | Video completion webhook     | No            |
| POST   | `/caption-complete`                | Caption completion webhook   | No            |
| POST   | `/scheduled-video-complete`        | Scheduled video completion   | No            |
| POST   | `/workflow-error`                  | Workflow error webhook       | No            |
| POST   | `/test`                            | Test webhook                 | No            |
| POST   | `/socialbu`                        | SocialBu webhook             | No            |
| GET    | `/users/:userId/socialbu-accounts` | Get user's SocialBu accounts | No            |
| DELETE | `/users/:userId/socialbu-accounts` | Remove SocialBu account      | No            |

### Webhooks V2 (`/api/v2/webhook`)

| Method | Endpoint          | Description        | Auth Required |
| ------ | ----------------- | ------------------ | ------------- |
| POST   | `/webhook/avatar` | Avatar webhook     | No            |
| POST   | `/webhook/test`   | Test webhook       | No            |
| POST   | `/webhook/verify` | Verify webhook     | No            |
| GET    | `/webhook/status` | Get webhook status | No            |

### Contact (`/api/contact`)

| Method | Endpoint | Description         | Auth Required |
| ------ | -------- | ------------------- | ------------- |
| POST   | `/`      | Submit contact form | No            |

### Cron Health (`/api/cron`)

| Method | Endpoint       | Description            | Auth Required |
| ------ | -------------- | ---------------------- | ------------- |
| GET    | `/health`      | Get cron health status | No            |
| POST   | `/reset-stats` | Reset cron statistics  | No            |

### Utility Endpoints

| Method | Endpoint        | Description               | Auth Required |
| ------ | --------------- | ------------------------- | ------------- |
| GET    | `/health`       | Health check              | No            |
| GET    | `/mongo-status` | MongoDB connection status | No            |

## 🔄 Queue System

The application uses **BullMQ** (Redis-backed) for background job processing.

### Queue: Photo Avatar Processing

- **Queue Name**: `photo-avatar`
- **Purpose**: Process photo avatar creation asynchronously
- **Worker**: `src/queues/photoAvatarWorker.ts`
- **Process Flow**:
  1. Upload image to HeyGen API
  2. Create avatar group
  3. Wait 20 seconds (training delay)
  4. Train avatar group
  5. Save avatar to database
  6. Cleanup temporary files

### Features

- Real-time progress notifications via WebSocket
- Comprehensive error handling with specific error codes
- Automatic cleanup of temporary files
- Job persistence in Redis (survives restarts)

## ⏰ Cron Jobs

The application runs several automated cron jobs:

1. **Avatar Status Check** - Runs every 5 minutes

   - Checks pending avatar training status
   - Updates avatar records in database

2. **HeyGen Avatar Sync** - Runs every 12 hours

   - Syncs available avatars from HeyGen API
   - Updates database with new/updated avatars

3. **Scheduled Video Processing** - Runs on configured schedule

   - Processes scheduled video creation
   - Handles video generation and posting

4. **Subscription Sync** - Runs hourly

   - Syncs subscriptions from Stripe
   - Handles recurring payments automatically

5. **ElevenLabs Voices Sync** - Runs at 11:03 AM and 11:03 PM
   - Fetches voices from ElevenLabs API
   - Adds new voices, updates existing ones
   - Removes deleted voices (except cloned)

## 🏗️ Architecture

### Directory Structure

```
src/
├── app.ts                 # Express app setup and middleware
├── server.ts              # Server entry point
├── config/                # Configuration files
│   ├── mongoose.ts        # MongoDB connection
│   └── cron.config.ts     # Cron job configurations
├── constants/             # Application constants
├── controllers/           # Request handlers
├── cron/                  # Cron job implementations
├── middleware/            # Express middleware
│   ├── auth.ts           # Authentication middleware
│   ├── rate-limiting.ts  # Rate limiting
│   └── security.ts      # Security headers
├── models/                # Mongoose models
├── queues/                # BullMQ queues and workers
├── routes/                # API route definitions
│   ├── v1/               # Version 1 routes
│   └── v2/               # Version 2 routes
├── services/              # Business logic
│   ├── auth/             # Authentication services
│   ├── video/            # Video services
│   ├── payment/          # Payment services
│   ├── socialbu/         # SocialBu integration
│   └── webhook/          # Webhook handlers
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
└── validations/           # Request validation schemas
```

### Key Components

- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic and external API integrations
- **Models**: Database schemas (Mongoose)
- **Routes**: API route definitions organized by version
- **Middleware**: Authentication, rate limiting, security, validation
- **Queues**: Background job processing with BullMQ
- **Cron Jobs**: Scheduled automated tasks

## 🔐 Environment Variables

See `env.example` for all required environment variables. Key variables include:

### Database

- `MONGODB_URI` - MongoDB connection string

### Authentication

- `JWT_SECRET` - JWT signing secret

### Email

- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`

### AWS S3

- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### Redis (Queue System)

- `REDIS_HOST` - Redis host (default: 127.0.0.1)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password (optional)

### External APIs

- `OPENAI_API_KEY` - OpenAI API key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `HEYGEN_API_KEY` - HeyGen API key
- `HEYGEN_BASE_URL` - HeyGen API base URL
- `ELEVENLABS_API_KEY` - ElevenLabs API key
- SocialBu API credentials

### Server

- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS and email links

## 📜 Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript for production
- `npm start` - Start production server
- `npm run init-templates` - Initialize dynamic templates
- `npm run init-enhanced-templates` - Initialize enhanced templates

## 🔒 Security Features

- JWT-based authentication
- Rate limiting on API endpoints
- CORS configuration
- Security headers (Helmet)
- Input sanitization
- Request validation
- CSRF protection
- Password hashing (bcrypt)

## 📡 Real-time Features

- WebSocket support for real-time notifications
- Progress tracking for video generation
- Live updates for avatar processing
- Real-time subscription status updates

## 🧪 Testing

Health check endpoints:

- `GET /health` - Basic health check
- `GET /mongo-status` - MongoDB connection status
- `GET /api/cron/health` - Cron job health status

## 📝 Notes

- All API endpoints return JSON responses
- Protected routes require Bearer token in Authorization header
- File uploads support large files (up to 1GB for video generation)
- WebSocket connections are established automatically for authenticated users
- Queue jobs persist in Redis and survive server restarts

## 🤝 Contributing

1. Follow the existing code structure
2. Use TypeScript for all new code
3. Add proper error handling
4. Include request validation
5. Update this README for new endpoints


