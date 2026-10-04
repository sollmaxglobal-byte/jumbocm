-- Auto-withdrawal corrections:
-- 1. The MTN USSD code takes the destination number BEFORE the amount:
--    *126*9*{phone}*{amount}#. A previous migration had flipped it to
--    amount-first, which the MTN menu rejects, so the transfer never ran.
-- 2. A payout is approved by MTN's confirmation SMS (see /api/public/mm-sms),
--    not by the phone reporting success, so claim_auto_withdrawal only hands out
--    the code and leaves the withdrawal 'dispatched'.
--
-- Re-runnable (matches the other migrations here).

ALTER TABLE public.app_settings
  ALTER COLUMN auto_withdraw_ussd_template SET DEFAULT '*126*9*{phone}*{amount}#';

UPDATE public.app_settings
   SET auto_withdraw_ussd_template = '*126*9*{phone}*{amount}#'
 WHERE auto_withdraw_ussd_template IS NULL
    OR auto_withdraw_ussd_template IN ('', '*126*9*{amount}*{phone}#');

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
BEGIN
  SELECT * INTO s FROM public.app_settings WHERE id = 1;
  IF s IS NULL OR NOT COALESCE(s.auto_withdraw_enabled, false) THEN
    RETURN jsonb_build_object('claimed', 'false', 'reason', 'Automatic withdrawal is disabled');
  END IF;
  tpl := COALESCE(NULLIF(s.auto_withdraw_ussd_template, ''), '*126*9*{phone}*{amount}#');

  -- Re-queue withdrawals that were dispatched but never confirmed (stuck > 10 min).
  UPDATE public.withdrawals
     SET auto_state = 'queued'
   WHERE auto_state = 'dispatched'
     AND status = 'pending'
     AND dispatched_at < now() - interval '10 minutes'
     AND auto_attempts < 3;

  -- Only MTN Mobile Money numbers (67x, 650-654, 68x) are paid automatically.
  SELECT * INTO w
    FROM public.withdrawals
   WHERE status = 'pending'
     AND method = 'mobile_money'
     AND auto_state = 'queued'
     AND right(regexp_replace(account_number, '[^0-9]', '', 'g'), 9) ~ '^(67|65[0-4]|68)[0-9]+$'
     AND length(right(regexp_replace(account_number, '[^0-9]', '', 'g'), 9)) = 9
     AND (s.auto_withdraw_max_amount IS NULL OR amount <= s.auto_withdraw_max_amount)
   ORDER BY created_at
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF w IS NULL THEN
    RETURN jsonb_build_object('claimed', 'false', 'reason', 'Nothing to pay');
  END IF;

  digits := right(regexp_replace(w.account_number, '[^0-9]', '', 'g'), 9);
  code := replace(replace(tpl, '{phone}', digits), '{amount}', trunc(w.amount)::text);

  UPDATE public.withdrawals
     SET auto_state = 'dispatched',
         dispatched_at = now(),
         auto_attempts = auto_attempts + 1,
         auto_note = 'Sent to phone automation'
   WHERE id = w.id;

  RETURN jsonb_build_object(
    'claimed', 'true',
    'id', w.id,
    'phone', digits,
    'amount', trunc(w.amount),
    'account_name', w.account_name,
    'code', code,
    'provider', 'mtn'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_auto_withdrawal() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_auto_withdrawal() TO service_role;

NOTIFY pgrst, 'reload schema';
