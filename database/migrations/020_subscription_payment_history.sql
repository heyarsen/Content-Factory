-- Migration: Add subscription payment history tracking
-- Tracks renewal attempts and payment history for subscriptions

-- Create subscription_payment_history table
CREATE TABLE IF NOT EXISTS subscription_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL, -- WayForPay transaction ID
  payment_type TEXT NOT NULL CHECK (payment_type IN ('initial', 'renewal')),
  transaction_status TEXT NOT NULL, -- 'Approved', 'Declined', 'Expired', 'Refunded'
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  credits_before INTEGER, -- User's credits before this payment
  credits_after INTEGER, -- User's credits after this payment
  credits_added INTEGER, -- Credits added by this payment (for renewals)
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  error_message TEXT, -- Any error message from payment gateway
  metadata JSONB -- Additional payment data from WayForPay
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_payment_history_subscription_id ON subscription_payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payment_history_payment_id ON subscription_payment_history(payment_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payment_history_payment_date ON subscription_payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_subscription_payment_history_type_status ON subscription_payment_history(payment_type, transaction_status);

-- Enable RLS
ALTER TABLE subscription_payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "System can manage payment history" ON subscription_payment_history;
CREATE POLICY "System can manage payment history"
  ON subscription_payment_history FOR ALL
  WITH CHECK (true); -- Controlled by backend

-- Function to record subscription payment
CREATE OR REPLACE FUNCTION record_subscription_payment(
  p_subscription_id UUID,
  p_payment_id TEXT,
  p_payment_type TEXT,
  p_transaction_status TEXT,
  p_amount DECIMAL(10, 2),
  p_currency TEXT DEFAULT 'USD',
  p_credits_before INTEGER DEFAULT NULL,
  p_credits_after INTEGER DEFAULT NULL,
  p_credits_added INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  payment_history_id UUID;
BEGIN
  INSERT INTO subscription_payment_history (
    subscription_id,
    payment_id,
    payment_type,
    transaction_status,
    amount,
    currency,
    credits_before,
    credits_after,
    credits_added,
    error_message,
    metadata
  ) VALUES (
    p_subscription_id,
    p_payment_id,
    p_payment_type,
    p_transaction_status,
    p_amount,
    p_currency,
    p_credits_before,
    p_credits_after,
    p_credits_added,
    p_error_message,
    p_metadata
  ) RETURNING id INTO payment_history_id;
  
  RETURN payment_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get subscription payment history
CREATE OR REPLACE FUNCTION get_subscription_payment_history(
  p_subscription_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  payment_id TEXT,
  payment_type TEXT,
  transaction_status TEXT,
  amount DECIMAL(10, 2),
  currency TEXT,
  credits_before INTEGER,
  credits_after INTEGER,
  credits_added INTEGER,
  payment_date TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sph.id,
    sph.payment_id,
    sph.payment_type,
    sph.transaction_status,
    sph.amount,
    sph.currency,
    sph.credits_before,
    sph.credits_after,
    sph.credits_added,
    sph.payment_date,
    sph.error_message,
    sph.metadata
  FROM subscription_payment_history sph
  WHERE sph.subscription_id = p_subscription_id
  ORDER BY sph.payment_date DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE subscription_payment_history IS 'Tracks all subscription payment attempts and results';
COMMENT ON COLUMN subscription_payment_history.payment_type IS 'Type of payment: initial or renewal';
COMMENT ON COLUMN subscription_payment_history.transaction_status IS 'Status from payment gateway: Approved, Declined, Expired, Refunded';
COMMENT ON COLUMN subscription_payment_history.credits_added IS 'Credits added by this payment (mainly for renewals)';
