# EdgeAI Backend

Express.js backend with TypeScript, providing the same API endpoints as the Next.js version.

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Copy environment variables:
```bash
cp env.example .env
```

3. Configure your environment variables in `.env`

4. Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:4000`

## API Endpoints

All endpoints are available under `/api` to match the Next.js structure:

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (requires Bearer token)
- `PUT /api/auth/profile` - Update user profile (requires Bearer token)
- `POST /api/auth/logout` - User logout (requires Bearer token)
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/verify-email` - Verify email with token
- `POST /api/auth/resend-verification` - Resend verification email
- `GET /api/auth/check-email` - Check if email exists
- `POST /api/auth/check-email-verification` - Check email verification status
- `POST /api/auth/validate-token` - Validate JWT token
- `POST /api/auth/clear-expired-tokens` - Clear expired tokens
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/csrf-token` - Get CSRF token

### Video Management
- `GET /api/video/gallery` - Get user's video gallery (requires Bearer token)
- `POST /api/video/download` - Download video from external URL and upload to S3
- `POST /api/video/status` - Update video status
- `POST /api/video/delete` - Delete video (requires Bearer token)
- `GET /api/video/download-proxy` - Proxy video download

### Webhooks
- `POST /api/webhook/video-complete` - Video processing completion webhook

### Utility
- `GET /api/csrf-token` - Get CSRF token
- `GET /health` - Health check

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server

## Architecture

- **Controllers**: Handle HTTP requests/responses (`src/controllers/`)
- **Services**: Business logic (`src/services/`)
- **Models**: Database schemas (`src/models/`)
- **Routes**: API route definitions (`src/routes/`)
- **Config**: Database and other configurations (`src/config/`)

## Environment Variables

See `env.example` for all required environment variables.

## Migration from Next.js

This backend provides identical API responses to the Next.js version. To migrate:

1. Start this Express server
2. Update your frontend to point to `http://localhost:4000/api/*` instead of `/api/*`
3. Verify all endpoints work correctly
4. Remove the Next.js API routes
