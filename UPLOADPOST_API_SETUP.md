# Upload-Post.com API Setup

## Current Issue

The social account connection is failing with a 500 error. This is likely due to:

1. **Wrong API URL** - The base URL might be incorrect
2. **Wrong API endpoint** - The endpoint path might be different
3. **Invalid API key** - The UPLOADPOST_KEY might be incorrect or expired
4. **Wrong request format** - The API might expect a different request format

## How to Fix

### Step 1: Check Railway Logs

After trying to connect a social account, check your Railway logs for:
- "Upload-post API error details"
- The actual HTTP status code (404, 401, 403, etc.)
- The API response data

### Step 2: Verify API Documentation

You need to check the actual upload-post.com API documentation to confirm:

1. **Base URL**: Currently using `https://api.upload-post.com/v1`
   - Is this correct?
   - Should it be `https://api.upload-post.com` or something else?

2. **OAuth Connect Endpoint**: Currently using `/oauth/connect`
   - Is this the correct endpoint?
   - What parameters does it expect?

3. **Request Format**: Currently sending:
   ```json
   {
     "platform": "instagram",
     "redirect_uri": "https://app.contentfabrica.com/social/callback?platform=instagram"
   }
   ```
   - Does the API expect different field names?
   - Does it need additional parameters?

4. **Authentication**: Currently using `Bearer` token
   - Is this correct?
   - Should it be a different auth method?

### Step 3: Update Code

Once you have the correct API information, update:
- `backend/src/lib/uploadpost.ts` - Update API URL, endpoints, and request format
- Verify all endpoints match the actual API documentation

### Step 4: Test

After updating, test the connection again and check Railway logs for any remaining errors.

## Temporary Workaround

If the upload-post.com API is not ready yet, you can:

1. **Comment out the actual API call** and return a mock URL
2. **Add a feature flag** to disable social media features temporarily
3. **Use a different social media integration service**

## Current Implementation

The code is making a POST request to:
```
POST https://api.upload-post.com/v1/oauth/connect
Authorization: Bearer {UPLOADPOST_KEY}
Content-Type: application/json

{
  "platform": "instagram|tiktok|youtube|facebook",
  "redirect_uri": "https://app.contentfabrica.com/social/callback?platform=..."
}
```

Expected response:
```json
{
  "auth_url": "https://...",
  // or
  "url": "https://...",
  // or
  "redirect_url": "https://..."
}
```

If the actual API uses different field names or structure, update the code accordingly.

