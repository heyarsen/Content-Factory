-- Migration: Backfill Missing User Profiles
-- Description: Ensures all users in auth.users have a corresponding record in user_profiles

INSERT INTO user_profiles (id, credits, role, preferred_language)
SELECT id, 3, 'user', 'en'
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;

-- Also ensure any user with email containing 'admin' or 'arseny' (optional, but helpful for this user) 
-- is an admin if they should be. Actually, better not to guess.
-- But we can inform the user to run the manual update if they haven't.
