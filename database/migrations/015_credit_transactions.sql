-- Migration: Credit Transactions and Top-ups
-- Creates tables for tracking credit transactions and top-up packages

-- Create credit_transactions table to track all credit operations
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('topup', 'deduction', 'refund', 'adjustment')),
  amount INTEGER NOT NULL, -- Positive for topups/refunds, negative for deductions
  balance_before INTEGER, -- Balance before transaction (NULL if unlimited)
  balance_after INTEGER, -- Balance after transaction (NULL if unlimited)
  operation TEXT, -- Description of operation (e.g., 'video_generation', 'topup_package_1')
  description TEXT, -- Human-readable description
  payment_id TEXT, -- WayForPay transaction ID for top-ups
  payment_status TEXT, -- 'pending', 'completed', 'failed', 'refunded'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_payment_id ON credit_transactions(payment_id) WHERE payment_id IS NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create transactions"
  ON credit_transactions FOR INSERT
  WITH CHECK (true); -- Will be controlled by backend

-- Create top-up packages table (static data)
CREATE TABLE IF NOT EXISTS credit_packages (
  id TEXT PRIMARY KEY, -- e.g., 'package_1', 'package_2'
  credits INTEGER NOT NULL,
  price_usd DECIMAL(10, 2) NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert top-up packages
INSERT INTO credit_packages (id, credits, price_usd, display_name, description, sort_order) VALUES
  ('package_1', 10, 10.00, 'Starter Pack', '10 credits for $10', 1),
  ('package_2', 25, 20.00, 'Value Pack', '25 credits for $20', 2),
  ('package_3', 50, 40.00, 'Popular Pack', '50 credits for $40', 3),
  ('package_4', 100, 80.00, 'Pro Pack', '100 credits for $80', 4),
  ('package_5', 200, 150.00, 'Mega Pack', '200 credits for $150', 5)
ON CONFLICT (id) DO UPDATE SET
  credits = EXCLUDED.credits,
  price_usd = EXCLUDED.price_usd,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Enable RLS for packages (read-only for all authenticated users)
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages"
  ON credit_packages FOR SELECT
  USING (is_active = true);

-- Add comment
COMMENT ON TABLE credit_transactions IS 'Tracks all credit transactions: top-ups, deductions, refunds, and adjustments';
COMMENT ON TABLE credit_packages IS 'Available credit top-up packages';

