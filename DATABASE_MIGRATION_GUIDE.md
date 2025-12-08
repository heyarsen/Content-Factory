# Database Migration Guide - Video Plans

This guide will help you set up the video planning tables in your Supabase database.

## Migration Files

1. `database/migrations/002_video_plans_tables.sql` - Creates the base video_plans and video_plan_items tables
2. `database/migrations/003_add_automation_fields.sql` - Adds automation fields to existing tables (safe to run if tables already exist)
3. `database/migrations/007_add_avatar_to_plan_items.sql` - Adds avatar_id column to video_plan_items table (optional, but recommended if using avatars)
4. `database/migrations/012_add_talking_photo_id_to_plan_items.sql` - Adds talking_photo_id column so each scheduled item can store the specific look (talking photo)

## Steps to Run Migrations

### Option 1: Run in Supabase SQL Editor

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `database/migrations/002_video_plans_tables.sql`
4. Click **Run** to execute
5. Repeat for `database/migrations/003_add_automation_fields.sql`
6. (Optional) Run `database/migrations/007_add_avatar_to_plan_items.sql` if you want to use avatars with plan items
7. (Recommended) Run `database/migrations/012_add_talking_photo_id_to_plan_items.sql` so plan items can reference the exact avatar look/talking photo

### Option 2: Using Supabase CLI

```bash
# Make sure you have Supabase CLI installed and authenticated
supabase db push

# Or run migrations individually
supabase migration up
```

## Verification

After running the migrations, verify the tables exist:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('video_plans', 'video_plan_items');

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('video_plans', 'video_plan_items');
```

## Troubleshooting

### Error: "Could not find the table 'public.video_plans' in the schema cache"

This error occurs when:
1. The migrations haven't been run yet
2. The schema cache needs to be refreshed

**Solution:**
1. Run the migration files in order (002, then 003)
2. Restart your Supabase project or wait a few minutes for the cache to refresh
3. If using Supabase CLI, run `supabase db reset` (⚠️ This will delete all data!)

### Error: "column already exists"

This is normal when running `003_add_automation_fields.sql` or `007_add_avatar_to_plan_items.sql` on tables that already have some fields. The migrations use `IF NOT EXISTS` checks, so it's safe to run multiple times.

### Error: "Could not find the 'avatar_id' column" (PGRST204)

This error occurs when the `avatar_id` column doesn't exist in the `video_plan_items` table. The application will work without this column, but if you want to use avatars with plan items, you should run migration `007_add_avatar_to_plan_items.sql`.

**Solution:**
1. Run the migration file `database/migrations/007_add_avatar_to_plan_items.sql` in the Supabase SQL Editor
2. The application code will automatically handle this gracefully if the column doesn't exist (it will skip avatar_id when inserting items)

### Error: "Could not find the 'talking_photo_id' column" (PGRST204)

This means the `talking_photo_id` column hasn't been added yet. Run migration `012_add_talking_photo_id_to_plan_items.sql` so each plan item can store the look ID used for video generation. The backend now skips this column automatically if it's missing, but you should run the migration to re-enable the feature.

## Production Checklist

- [ ] Run migration 002 to create base tables
- [ ] Run migration 003 to add automation fields
- [ ] (Optional) Run migration 007 to add avatar_id column if using avatars
- [ ] Run migration 012 to add talking_photo_id column so plan items can reference looks
- [ ] Verify RLS policies are active
- [ ] Test creating a plan via the UI
- [ ] Verify indexes are created for performance
- [ ] Check that triggers are working (updated_at)

## Rollback

If you need to rollback (⚠️ This will delete all video plans data):

```sql
-- Drop tables (use with caution!)
DROP TABLE IF EXISTS video_plan_items CASCADE;
DROP TABLE IF EXISTS video_plans CASCADE;
```

## Schema Overview

### video_plans
- Stores video plan configurations
- Includes automation settings (trigger time, platforms, auto-approve)
- Supports timezone-aware scheduling

### video_plan_items  
- Individual video slots in a plan
- Tracks status through the pipeline (pending → researching → ready → draft → approved → generating → completed → scheduled → posted)
- Stores scripts, research data, and video references
