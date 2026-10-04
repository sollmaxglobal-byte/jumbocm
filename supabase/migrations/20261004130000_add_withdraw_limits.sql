-- Admin-configurable withdrawal limits: the minimum and maximum amount a user may request.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS withdraw_min_amount numeric NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS withdraw_max_amount numeric NOT NULL DEFAULT 50000000;

UPDATE public.app_settings
SET withdraw_min_amount = coalesce(withdraw_min_amount, 250),
    withdraw_max_amount = coalesce(withdraw_max_amount, 50000000);

-- Expose the limits publicly so the withdraw page can validate without admin rights.
DROP VIEW IF EXISTS public.public_settings;
CREATE VIEW public.public_settings
WITH (security_invoker = false) AS
SELECT id, site_name, site_url, tidio_public_key, tawk_property_id, tawk_widget_id,
       sendpulse_chat_id, sendpulse_embed_html,
       announcement_enabled, announcement_title, announcement_message,
       announcement_link, announcement_link_label, announcement_version,
       deposit_min_amount, deposit_max_amount,
       withdraw_min_amount, withdraw_max_amount,
       mtn_number, orange_number, mtn_enabled, orange_enabled,
       referral_percent, korapay_enabled, nowpayments_enabled
FROM public.app_settings
WHERE id = 1;

GRANT SELECT ON public.public_settings TO anon, authenticated;

-- Enforce the configured limits server-side, replacing the hardcoded 250 minimum.
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _method text, _account_name text, _account_number text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur numeric;
  new_id uuid;
  clean_name text := trim(COALESCE(_account_name, ''));
  clean_number text := trim(COALESCE(_account_number, ''));
  min_amount numeric;
  max_amount numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT coalesce(withdraw_min_amount, 250), coalesce(withdraw_max_amount, 50000000)
    INTO min_amount, max_amount
    FROM public.app_settings WHERE id = 1;

  IF _amount IS NULL OR _amount < min_amount THEN
    RAISE EXCEPTION 'Minimum withdrawal is % XAF', min_amount;
  END IF;
  IF _amount > max_amount THEN
    RAISE EXCEPTION 'Maximum withdrawal is % XAF', max_amount;
  END IF;
  IF _amount <> trunc(_amount) THEN RAISE EXCEPTION 'Withdrawal amount must be a whole number'; END IF;
  IF _method NOT IN ('mobile_money','bank_transfer','crypto') THEN RAISE EXCEPTION 'Invalid method'; END IF;
  IF length(clean_name) < 2 OR length(clean_name) > 120 THEN RAISE EXCEPTION 'Enter a valid account name'; END IF;
  IF length(clean_number) < 4 OR length(clean_number) > 120 THEN RAISE EXCEPTION 'Enter a valid account number'; END IF;

  SELECT balance INTO cur FROM public.profiles WHERE id = uid FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'Account profile not found'; END IF;
  IF cur < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  INSERT INTO public.withdrawals(user_id, amount, method, account_name, account_number, status)
  VALUES (uid, _amount, _method::public.payment_method_type, clean_name, clean_number, 'pending')
  RETURNING id INTO new_id;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles SET balance = balance - _amount WHERE id = uid;

  INSERT INTO public.transactions(user_id, type, amount, description, ref_id)
  VALUES (uid, 'withdrawal_hold'::public.transaction_type, -_amount, 'Withdrawal request submitted (funds held)', new_id);

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
