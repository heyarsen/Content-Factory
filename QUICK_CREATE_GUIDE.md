# Quick Create - Simplified Video Creation

## Overview

Quick Create is a streamlined 3-step wizard that simplifies the video creation process. Instead of managing complex workflows, users can now create videos in a single, intuitive flow.

## How It Works

### Step 1: Your Idea
- Select a category (Trading, Lifestyle, or Financial Freedom)
- Enter your topic (e.g., "5 Trading Mistakes Beginners Make")
- Optionally add:
  - Description for more context
  - Why this is important
  - Useful tips

### Step 2: AI-Generated Script
- AI automatically generates a professional script based on your inputs
- Script follows category-specific guidelines:
  - **Trading**: 60-70 words, educational, compliance-safe
  - **Lifestyle**: 55-65 words, inspirational, positive tone
  - **Financial Freedom**: 70-85 words, educational, neutral tone
- You can review and edit the script before proceeding

### Step 3: Generate Video
- Review your script one final time
- Choose video style (Casual, Professional, Energetic, Educational)
- Set duration (15-60 seconds)
- Generate your video

## Benefits

1. **Simplified Workflow**: No need to understand complex content factory systems
2. **Fast Creation**: Create videos in minutes instead of navigating multiple screens
3. **AI-Powered**: Automatic script generation based on category best practices
4. **Editable**: Review and adjust scripts before video generation
5. **Direct Path**: Go from idea to video without intermediate steps

## Technical Details

### Frontend
- **Route**: `/quick-create`
- **Component**: `frontend/src/pages/QuickCreate.tsx`
- **Features**:
  - Step-by-step wizard UI
  - Real-time progress indicators
  - Script preview and editing
  - Category auto-loading

### Backend
- **Endpoint**: `POST /api/content/quick-create/generate-script`
- **Input**: Category, topic, optional description/whyImportant/usefulTips
- **Output**: Generated script text
- **Logic**: Uses OpenAI GPT-4 with category-specific prompts

### Category Mapping
The system automatically maps category keys to full names:
- `trading` → `Trading`
- `lifestyle` → `Lifestyle`
- `fin_freedom` or `fin. freedom` → `Fin. Freedom`

## User Experience Improvements

### Before
- Navigate to Content Factory
- Create content item
- Research topic
- Generate script
- Create reel
- Approve
- Generate video

### After
- Click "Quick Create"
- Enter idea → AI generates script → Generate video
- **3 steps total**

## Integration

Quick Create integrates with:
- Existing category system (uses active categories)
- Video generation service (same backend)
- Script generation service (reuses OpenAI prompts)
- Video library (saves to same database)

## Future Enhancements

Potential improvements:
- Save drafts at each step
- Template suggestions based on topic
- Preview video thumbnail before generation
- Batch creation for multiple topics
- Social media scheduling integration
