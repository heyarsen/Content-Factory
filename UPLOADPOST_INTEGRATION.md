# Upload-Post.com API Integration Guide

## API Changes Based on Official Documentation

Based on the [Upload-Post API documentation](https://docs.upload-post.com/api/reference), the implementation has been updated:

### Key Changes:

1. **Base URL**: Changed from `https://api.upload-post.com/v1` to `https://api.upload-post.com/api`
2. **Authentication**: Changed from `Bearer {token}` to `Apikey {api-key}` format
3. **User Management**: Uses JWT-based user profiles instead of OAuth redirects

## How It Works Now

### Social Account Connection Flow:

1. **User clicks "Connect"** → Backend creates/gets Upload-Post user profile
2. **Backend generates JWT** → Returns JWT to frontend
3. **User links accounts** → Uses JWT with Upload-Post's account linking system
4. **Account confirmed** → Frontend calls `/api/social/callback` with user ID

### Video Posting Flow:

1. **User schedules post** → Backend calls `POST /api/upload_videos`
2. **Single API call** → Posts to multiple platforms at once
3. **Async upload** → Returns upload ID for status tracking
4. **Status polling** → Use `GET /api/uploadposts/status` to check progress

## Current Implementation Status

✅ **Completed:**
- Updated API base URL and authentication format
- Created user profile management functions
- Updated video posting to use new API format
- Updated status checking

⚠️ **Needs Integration:**
- Upload-Post account linking widget/UI
- The frontend currently shows JWT but needs Upload-Post's linking interface

## Next Steps

1. **Check Upload-Post Documentation** for:
   - Account linking widget/UI integration guide
   - How to use the JWT for account linking
   - Frontend SDK or iframe integration options

2. **Update Frontend** to:
   - Integrate Upload-Post's account linking widget (if available)
   - Handle the JWT-based linking flow
   - Show proper UI for account connection process

3. **Test the Integration**:
   - Create user profiles
   - Generate JWTs
   - Link social accounts
   - Post videos

## API Endpoints Used

- `POST /api/uploadposts/users` - Create user profile
- `POST /api/uploadposts/users/generate-jwt` - Generate JWT for linking
- `GET /api/uploadposts/users` - Get user profile
- `POST /api/upload_videos` - Upload video to platforms
- `GET /api/uploadposts/status` - Check upload status

## Reference

- [Upload-Post API Reference](https://docs.upload-post.com/api/reference)

