# Make.com Workflow Migration - Implementation Summary

## Overview

This document describes the migration of 6 Make.com workflows to the Node.js/Express platform using Supabase.

## Database Tables

Run the migration SQL file:
```bash
database/migrations/001_content_factory_tables.sql
```

New tables:
- `content_items` - Replaces Airtable "💡Контент" table
- `reels` - Replaces "🌐 Соцсети рилсы" table
- `background_jobs` - Supabase-based job queue system
- `content_research` - Optional research history

## Environment Variables

Add these to your `.env` file:

```env
OPENAI_API_KEY=your_openai_key
PERPLEXITY_API_KEY=your_perplexity_key
HEYGEN_KEY=your_heygen_key (already exists)
UPLOADPOST_KEY=your_uploadpost_key (already exists)
```

## API Endpoints

### Content Management
- `POST /api/content/generate-topics` - Scout-Research Hunter: Generate 3 topics
- `POST /api/content/research` - Research a specific topic
- `POST /api/content/generate-script` - A_Script Creation: Generate script from content item

### Reel Management
- `GET /api/reels/pending` - Get pending reels
- `POST /api/reels/:id/approve` - Approve a reel (replaces Telegram confirm)
- `POST /api/reels/:id/reject` - Reject a reel (replaces Telegram cancel)
- `POST /api/reels/:id/generate-video` - Generate video for approved reel
- `GET /api/reels/:id` - Get reel by ID

## Scheduled Jobs

The system includes automatic scheduled jobs (via node-cron):

1. **Auto-approval** (every 5 minutes)
   - Checks for reels with `status='pending'` and `scheduled_time <= now`
   - Auto-approves and triggers video generation

2. **Script generation** (every 10 minutes)
   - Processes pending content items with research
   - Generates scripts and creates reels

3. **Video generation** (every 5 minutes)
   - Processes approved reels without video
   - Generates videos using HeyGen

4. **Research** (every 15 minutes)
   - Processes content items without research
   - Uses Perplexity AI to research topics

5. **Job queue processor** (every minute)
   - Processes background_jobs table
   - Handles retries and error logging

## Workflow Logic

### A_Script Creation
1. Find content item with `done=false` and `research` not null
2. Generate script using OpenAI based on category
3. Create reel with `status='pending'` and `scheduled_time=now+20min`
4. Mark content item as `done=true`
5. Schedule auto-approval check

### B_Script Confirm/Cancel (Platform-based)
- User approves/rejects via API endpoints
- If approved: status → `approved`, trigger video generation
- If rejected: status → `rejected`

### C_Auto Posting
- Cron job runs every 5 minutes
- Finds reels with `status='pending'` AND `scheduled_time <= now`
- Auto-approves and triggers video generation

### D_Posting Reals
- Finds approved reels without video
- Selects HeyGen template based on category
- Generates video and updates reel record

### Scout-Research Hunter
- Generates 3 topics using Perplexity (Trading, Fin. Freedom, Lifestyle)
- Creates content_items for each
- For items without research, uses Perplexity to research
- Updates content_items with research JSON

## Architecture

```
backend/src/
├── services/
│   ├── contentService.ts    - Content item management
│   ├── scriptService.ts     - Script generation
│   ├── researchService.ts   - Topic generation and research
│   ├── reelService.ts       - Reel management
│   ├── videoService.ts      - Video generation
│   └── jobService.ts        - Background job management
├── routes/
│   ├── content.ts           - Content endpoints (extended)
│   └── reels.ts             - Reel endpoints (new)
├── jobs/
│   ├── scheduler.ts          - Cron job initialization
│   └── processors.ts        - Job execution logic
└── lib/
    ├── openai.ts            - OpenAI integration
    └── perplexity.ts        - Perplexity AI integration
```

## Key Differences from Make.com

1. **No Telegram Integration** - Approve/reject handled via API endpoints
2. **Supabase-based Queue** - Uses `background_jobs` table instead of Redis
3. **Cron-based Scheduling** - Uses node-cron instead of Make.com triggers
4. **Direct Database Access** - All operations use Supabase client

## Testing

To test the workflows:

1. Generate topics:
   ```bash
   POST /api/content/generate-topics
   ```

2. Research a topic:
   ```bash
   POST /api/content/research
   Body: { "topic": "...", "category": "Trading", "content_item_id": "..." }
   ```

3. Generate script:
   ```bash
   POST /api/content/generate-script
   Body: { "content_item_id": "..." }
   ```

4. Approve/reject reel:
   ```bash
   POST /api/reels/:id/approve
   POST /api/reels/:id/reject
   ```

## Notes

- The scheduler is enabled by default but can be disabled with `ENABLE_SCHEDULER=false`
- All jobs use Supabase for persistence (no Redis needed)
- RLS policies ensure users can only access their own data
- Background jobs support retries (max 3 attempts by default)

