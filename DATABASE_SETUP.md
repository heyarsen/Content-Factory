# Database Setup Instructions

The application requires several database tables in Supabase. If you're seeing errors like "Could not find the table 'public.social_accounts'", you need to create these tables.

## Quick Setup

1. **Open Supabase Dashboard**
   - Go to your Supabase project: https://supabase.com/dashboard
   - Navigate to the SQL Editor

2. **Run the Migration SQL**
   - Copy the contents of `setup_database.sql`
   - Paste into the SQL Editor
   - Click "Run" or press `Cmd/Ctrl + Enter`

3. **Verify Tables Created**
   - Go to Table Editor in Supabase Dashboard
   - You should see:
     - `videos`
     - `social_accounts`
     - `scheduled_posts`

## What Gets Created

- **Tables:**
  - `videos` - Stores video generation requests and results
  - `social_accounts` - Stores connected social media accounts
  - `scheduled_posts` - Stores scheduled video posts

- **Security:**
  - Row Level Security (RLS) enabled on all tables
  - Policies ensure users can only access their own data

- **Indexes:**
  - Performance indexes on frequently queried columns

## Troubleshooting

If you get errors when running the SQL:

1. **"table already exists"** - Tables may already exist. The `CREATE TABLE IF NOT EXISTS` should handle this, but if not, you can drop and recreate:
   ```sql
   DROP TABLE IF EXISTS scheduled_posts CASCADE;
   DROP TABLE IF EXISTS social_accounts CASCADE;
   DROP TABLE IF EXISTS videos CASCADE;
   ```
   Then run `setup_database.sql` again.

2. **Permission errors** - Make sure you're running the SQL as a database admin/owner in Supabase.

3. **RLS policy errors** - If policies fail to create, you can create them manually or check the existing policies in the Authentication > Policies section.

