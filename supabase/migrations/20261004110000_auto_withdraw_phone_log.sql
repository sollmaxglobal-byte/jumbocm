-- Automatic withdrawal (MacroDroid / USSD auto-pay): make the queue response
-- unambiguous and record how far the phone macro got.
--
-- 1. claim_auto_withdrawal() used to return `claimed` as a JSON boolean. The
--    phone macro compares the parsed value against the string "true"; a boolean
--    that round-trips through MacroDroid's JSON Parse action is not guaranteed to
--    become the exact string "true", so the macro could claim a payout from the
--    queue (the HTTP call itself has that side effect) yet never dial it. Return
--    the flag as the plain text 'true'/'false' so the comparison is exact.
-- 2. auto_withdraw_logs lets the phone macro report each step (parsed, dialing,
--    pin-entered, result). The admin can then see exactly which step failed
--    instead of guessing.
--
-- Re-runnable (IF NOT EXISTS / OR REPLACE), matching the other migrations here.

CREATE TABLE IF NOT EXISTS public.auto_withdraw_logs (
  id bigserial PRIMARY KEY,
  withdrawal_id text,
  step text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auto_withdraw_logs_created_at_idx
  ON public.auto_withdraw_logs (created_at DESC);

ALTER TABLE public.auto_withdraw_logs ENABLE ROW LEVEL SECURITY;

-- Only administrators may read the log; the phone macro writes through the
-- service-role RPC below.
DROP POLICY IF EXISTS "Admins read auto withdraw logs" ON public.auto_withdraw_logs;
CREATE POLICY "Admins read auto withdraw logs"
  ON public.auto_withdraw_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.auto_withdraw_logs FROM anon, authenticated;
GRANT SELECT ON public.auto_withdraw_logs TO authenticated;
GRANT ALL ON public.auto_withdraw_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.auto_withdraw_logs_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.log_auto_withdraw_step(
  _withdrawal_id text,
  _step text,
  _detail text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auto_withdraw_logs (withdrawal_id, step, detail)
  VALUES (NULLIF(_withdrawal_id, ''), left(_step, 60), left(_detail, 400));

  -- Keep the table small: the log is a diagnostic, not an audit trail.
  DELETE FROM public.auto_withdraw_logs WHERE created_at < now() - interval '7 days';
END;
$$;

REVOKE ALL ON FUNCTION public.log_auto_withdraw_step(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_auto_withdraw_step(text, text, text) TO service_role;

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
  tpl := COALESCE(NULLIF(s.auto_withdraw_ussd_template, ''), '*126*9*{amount}*{phone}#');

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
  code := replace(replace(tpl, '{amount}', trunc(w.amount)::text), '{phone}', digits);

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
