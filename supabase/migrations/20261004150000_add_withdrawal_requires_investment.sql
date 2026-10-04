-- Admin-configurable "Require an active investment" for withdrawals.
--
-- The admin settings page showed a placeholder here ("temporarily unavailable
-- until the database migration is applied") because the backing column and RPC
-- change never landed: can_withdraw() unconditionally required an investment,
-- so the toggle could not be exposed. This adds the setting, defaulting to ON so
-- existing behaviour is unchanged, and makes can_withdraw() honour it.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS withdrawal_requires_investment boolean NOT NULL DEFAULT true;

UPDATE public.app_settings
SET withdrawal_requires_investment = true
WHERE withdrawal_requires_investment IS NULL;

CREATE OR REPLACE FUNCTION public.can_withdraw(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  suspended boolean;
  require_investment boolean := true;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT is_suspended INTO suspended FROM public.profiles WHERE id = _user_id;
  IF suspended IS NULL OR suspended THEN RETURN false; END IF;

  SELECT coalesce(withdrawal_requires_investment, true)
    INTO require_investment
    FROM public.app_settings WHERE id = 1;

  IF require_investment THEN
    RETURN EXISTS (SELECT 1 FROM public.investments WHERE user_id = _user_id);
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.can_withdraw(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_withdraw(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
