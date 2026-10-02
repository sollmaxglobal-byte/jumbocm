-- NOWPayments (crypto) deposit gateway: admin-configurable settings + settlement.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS nowpayments_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nowpayments_api_key text,
  ADD COLUMN IF NOT EXISTS nowpayments_ipn_secret text;

-- Expose only the enabled flag publicly; the API key and IPN secret stay admin-only.
DROP VIEW IF EXISTS public.public_settings;
CREATE VIEW public.public_settings
WITH (security_invoker = false) AS
SELECT id, site_name, site_url, tidio_public_key, tawk_property_id, tawk_widget_id,
       sendpulse_chat_id, sendpulse_embed_html,
       announcement_enabled, announcement_title, announcement_message,
       announcement_link, announcement_link_label, announcement_version,
       deposit_min_amount, deposit_max_amount,
       mtn_number, orange_number, mtn_enabled, orange_enabled,
       referral_percent, korapay_enabled, nowpayments_enabled
FROM public.app_settings
WHERE id = 1;

GRANT SELECT ON public.public_settings TO anon, authenticated;

-- Settle a crypto deposit by reference (mirrors settle_gateway_deposit, gateway = nowpayments).
CREATE OR REPLACE FUNCTION public.settle_nowpayments_deposit(
  _reference text,
  _gateway_ref text,
  _outcome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d public.deposits%ROWTYPE;
BEGIN
  IF coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     AND nullif(current_setting('request.jwt.claims', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO d FROM public.deposits
   WHERE reference = _reference AND gateway = 'nowpayments'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Deposit not found');
  END IF;

  IF d.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'status', d.status, 'reason', 'Already settled');
  END IF;

  IF _outcome = 'success' THEN
    UPDATE public.deposits
       SET status = 'approved',
           reviewed_at = now(),
           auto_approved_at = now(),
           gateway_ref = COALESCE(_gateway_ref, gateway_ref),
           gateway_status = 'finished',
           auto_note = 'Auto-approved: crypto payment confirmed'
     WHERE id = d.id;

    PERFORM set_config('app.bypass_profile_guard', 'on', true);
    UPDATE public.profiles SET balance = balance + d.amount WHERE id = d.user_id;

    INSERT INTO public.transactions(user_id, type, amount, description, ref_id)
    VALUES (d.user_id, 'deposit', d.amount, 'Crypto deposit', d.id);

    RETURN jsonb_build_object('ok', true, 'status', 'approved');
  ELSE
    UPDATE public.deposits
       SET status = 'rejected',
           reviewed_at = now(),
           gateway_ref = COALESCE(_gateway_ref, gateway_ref),
           gateway_status = _outcome,
           auto_note = 'Crypto payment did not complete'
     WHERE id = d.id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_nowpayments_deposit(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_nowpayments_deposit(text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
