-- Check your recent credit transactions
-- Run this in Supabase SQL Editor

-- First, let's see what columns actually exist in credit_transactions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'credit_transactions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Then check your recent transactions with correct column names
SELECT 
    created_at,
    operation,
    amount,
    balance_after
FROM credit_transactions 
WHERE user_id = 'YOUR_USER_ID_HERE'  -- Replace with your actual user ID
ORDER BY created_at DESC 
LIMIT 10;

-- Also check your current credit balance
SELECT 
    id,
    credits,
    updated_at
FROM user_profiles 
WHERE id = 'YOUR_USER_ID_HERE';  -- Replace with your actual user ID
