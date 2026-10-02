-- Add USSD push-webhook settings and Orange Money support to auto-withdrawal.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ussd_webhook_url text,
  ADD COLUMN IF NOT EXISTS ussd_pin text;

-- Re-define claim_auto_withdrawal to also return the provider ('mtn' or 'orange')
-- so the phone automation knows which USSD code sequence to dial.
CREATE OR REPLACE FUNCTION public.claim_auto_withdrawal()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  w record;
  tpl text;
  code text;
  digits text;
  provider text;
BEGIN
  SELECT * INTO s FROM public.app_settings WHERE id = 1;
  IF s IS NULL OR NOT COALESCE(s.auto_withdraw_enabled, false) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'Automatic withdrawal is disabled');
  END IF;
  tpl := COALESCE(NULLIF(s.auto_withdraw_ussd_template, ''), '*126*9*{phone}*{amount}#');

  -- Re-queue withdrawals that were dispatched but never confirmed (stuck > 10 min).
  UPDATE public.withdrawals
     SET auto_state = 'queued'
   WHERE auto_state = 'dispatched'
     AND status = 'pending'
     AND dispatched_at < now() - interval '10 minutes'
     AND auto_attempts < 3;

  SELECT * INTO w
    FROM public.withdrawals
   WHERE status = 'pending'
     AND auto_state = 'queued'
     AND (s.auto_withdraw_max_amount IS NULL OR amount <= s.auto_withdraw_max_amount)
   ORDER BY created_at
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF w IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'Nothing to pay');
  END IF;

  digits := regexp_replace(w.account_number, '[^0-9]', '', 'g');
  IF length(digits) > 9 THEN
    digits := right(digits, 9);
  END IF;

  -- Detect MTN vs Orange from the 9-digit local number.
  provider := CASE
    WHEN digits ~ '^67' OR digits ~ '^65[0-4]' OR digits ~ '^68[0-9]' THEN 'mtn'
    WHEN digits ~ '^69' OR digits ~ '^65[5-9]' THEN 'orange'
    ELSE 'mtn'
  END;

  code := replace(replace(tpl, '{phone}', digits), '{amount}', trunc(w.amount)::text);

  UPDATE public.withdrawals
     SET auto_state = 'dispatched',
         dispatched_at = now(),
         auto_attempts = auto_attempts + 1,
         auto_note = 'Sent to phone automation'
   WHERE id = w.id;

  RETURN jsonb_build_object(
    'claimed', true,
    'id', w.id,
    'phone', digits,
    'amount', trunc(w.amount),
    'account_name', w.account_name,
    'code', code,
    'provider', provider
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_auto_withdrawal() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_auto_withdrawal() TO service_role;

NOTIFY pgrst, 'reload schema';
