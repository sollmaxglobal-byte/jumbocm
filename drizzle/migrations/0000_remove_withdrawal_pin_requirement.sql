-- Withdrawals no longer require a security PIN.
CREATE OR REPLACE FUNCTION public.create_withdrawal(
  _amount NUMERIC, _method TEXT, _account_name TEXT, _account_number TEXT, _pin TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_withdraw(uid) THEN RAISE EXCEPTION 'Withdrawals are unavailable for this account'; END IF;
  RETURN public.request_withdrawal(_amount, _method, _account_name, _account_number);
END;
$$;

REVOKE ALL ON FUNCTION public.create_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- The withdrawal PIN is retired; only the transfer PIN remains in use.
CREATE OR REPLACE FUNCTION public.set_security_pin(_kind TEXT, _pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,6}$' THEN RAISE EXCEPTION 'PIN must be 4 to 6 digits'; END IF;
  IF _kind <> 'transfer' THEN RAISE EXCEPTION 'Unsupported PIN type'; END IF;
  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles SET transfer_pin_hash = crypt(_pin, gen_salt('bf')) WHERE id = uid;
  RETURN true;
END;
$$;

COMMENT ON COLUMN public.profiles.withdrawal_pin_hash IS 'DEPRECATED: withdrawal PINs were removed from the product.';