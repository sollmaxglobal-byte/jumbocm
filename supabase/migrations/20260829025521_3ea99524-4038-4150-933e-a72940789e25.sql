ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'withdrawal_hold';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'withdrawal_refund';