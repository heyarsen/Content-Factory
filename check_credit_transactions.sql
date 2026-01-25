-- Check your recent credit transactions
-- Run this in Supabase SQL Editor

SELECT 
    created_at,
    operation,
    amount,
    balance_after,
    reason
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
