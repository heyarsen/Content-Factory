-- Check current subscription plan prices
SELECT 
    id,
    name,
    display_name,
    price_usd,
    credits,
    is_active
FROM subscription_plans 
WHERE is_active = true
ORDER BY price_usd;

-- Check current credit package prices
SELECT 
    id,
    name,
    price_usd,
    credits,
    is_active
FROM credit_packages 
WHERE is_active = true
ORDER BY price_usd;
