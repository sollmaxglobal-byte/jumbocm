ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'withdrawal_hold';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'withdrawal_refund';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'profit';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'referral';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'investment_return';