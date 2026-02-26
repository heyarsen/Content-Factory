-- Migration: Support fractional credits (e.g., 0.5 for Nano Banana)

-- Allow fractional balances in user profiles
ALTER TABLE user_profiles
  ALTER COLUMN credits TYPE NUMERIC(10,2)
  USING credits::NUMERIC(10,2);

ALTER TABLE user_profiles
  ALTER COLUMN credits SET DEFAULT 3.00;

-- Allow fractional transactions and balances
ALTER TABLE credit_transactions
  ALTER COLUMN amount TYPE NUMERIC(10,2)
  USING amount::NUMERIC(10,2),
  ALTER COLUMN balance_before TYPE NUMERIC(10,2)
  USING balance_before::NUMERIC(10,2),
  ALTER COLUMN balance_after TYPE NUMERIC(10,2)
  USING balance_after::NUMERIC(10,2);

COMMENT ON COLUMN user_profiles.credits IS 'User credits. NULL = unlimited credits. Supports fractional values (e.g. 0.5).';
COMMENT ON COLUMN credit_transactions.amount IS 'Transaction delta in credits. Positive for topups/refunds, negative for deductions. Supports fractional values.';
COMMENT ON COLUMN credit_transactions.balance_before IS 'Balance before transaction. NULL if unlimited. Supports fractional values.';
COMMENT ON COLUMN credit_transactions.balance_after IS 'Balance after transaction. NULL if unlimited. Supports fractional values.';
