
DROP POLICY IF EXISTS "Public reads branding" ON public.app_settings;

DROP VIEW IF EXISTS public.public_app_settings;
CREATE VIEW public.public_app_settings
WITH (security_invoker = true) AS
SELECT id, site_name, site_url, referral_percent,
       tidio_public_key, sendpulse_chat_id, sendpulse_embed_html,
       tawk_property_id, tawk_widget_id
FROM public.app_settings;

REVOKE SELECT ON public.app_settings FROM anon, authenticated;
GRANT SELECT (id, site_name, site_url, referral_percent,
              tidio_public_key, sendpulse_chat_id, sendpulse_embed_html,
              tawk_property_id, tawk_widget_id)
  ON public.app_settings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_app_settings_admin()
RETURNS SETOF public.app_settings
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.app_settings WHERE id = 1;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_app_settings_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_app_settings_admin() TO authenticated;

GRANT SELECT ON public.public_app_settings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.profiles_prevent_privileged_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.total_earned IS DISTINCT FROM OLD.total_earned
     OR NEW.total_invested IS DISTINCT FROM OLD.total_invested
     OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.referral_earnings IS DISTINCT FROM OLD.referral_earnings
     OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'Cannot modify protected profile fields';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.profiles_prevent_privileged_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_block_privileged_updates ON public.profiles;
CREATE TRIGGER profiles_block_privileged_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_prevent_privileged_updates();

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins insert transactions" ON public.transactions;
CREATE POLICY "Admins insert transactions" ON public.transactions
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (auth.uid() IS NULL OR _user_id = auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_balance_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_balance_nonneg CHECK (balance >= 0) NOT VALID;

CREATE OR REPLACE FUNCTION public.activate_investment(_plan_id uuid, _amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur_balance numeric;
  cur_invested numeric;
  p RECORD;
  new_inv_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  SELECT * INTO p FROM public.plans WHERE id = _plan_id AND COALESCE(active, true) = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found or inactive'; END IF;
  IF _amount < p.min_amount OR _amount > p.max_amount THEN
    RAISE EXCEPTION 'Amount out of allowed range';
  END IF;

  SELECT balance, total_invested INTO cur_balance, cur_invested
    FROM public.profiles WHERE id = uid FOR UPDATE;
  IF cur_balance IS NULL OR cur_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.investments(user_id, plan_id, amount, daily_roi_percent, duration_days, end_date, status)
    VALUES (uid, _plan_id, _amount, p.daily_roi_percent, p.duration_days,
            now() + (p.duration_days || ' days')::interval, 'active')
    RETURNING id INTO new_inv_id;

  UPDATE public.profiles
    SET balance = cur_balance - _amount,
        total_invested = COALESCE(cur_invested, 0) + _amount
    WHERE id = uid;

  INSERT INTO public.transactions(user_id, type, amount, description, ref_id)
    VALUES (uid, 'investment', -_amount, 'Activated ' || p.name, new_inv_id);

  RETURN new_inv_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.activate_investment(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_investment(uuid, numeric) TO authenticated;

DROP POLICY IF EXISTS "Admins update payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete payment proofs" ON storage.objects;
CREATE POLICY "Admins update payment proofs" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete payment proofs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone reads branding via view" ON public.app_settings;
DROP POLICY IF EXISTS "Anon and users read app_settings row" ON public.app_settings;
CREATE POLICY "Anon and users read app_settings row" ON public.app_settings
FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.recent_activity(_limit integer DEFAULT 20)
RETURNS TABLE(kind text, first_name text, amount numeric, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT * FROM (
    (SELECT 'deposit'::text AS kind,
           COALESCE(NULLIF(trim(pr.full_name), ''), 'Investor') AS first_name,
           d.amount::numeric AS amount,
           d.created_at AS created_at
      FROM public.deposits d
      LEFT JOIN public.profiles pr ON pr.id = d.user_id
      WHERE d.status IN ('approved','pending')
        AND d.created_at >= now() - interval '30 minutes'
      ORDER BY d.created_at DESC
      LIMIT LEAST(GREATEST(_limit, 1), 100))
    UNION ALL
    (SELECT 'withdraw'::text,
           COALESCE(NULLIF(trim(pr.full_name), ''), 'Investor'),
           w.amount::numeric,
           w.created_at
      FROM public.withdrawals w
      LEFT JOIN public.profiles pr ON pr.id = w.user_id
      WHERE w.status IN ('paid','approved','pending')
        AND w.created_at >= now() - interval '30 minutes'
      ORDER BY w.created_at DESC
      LIMIT LEAST(GREATEST(_limit, 1), 100))
  ) t
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 100);
$function$;
REVOKE ALL ON FUNCTION public.recent_activity(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recent_activity(integer) TO anon, authenticated, service_role;
