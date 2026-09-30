DROP FUNCTION IF EXISTS public.create_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_withdrawal(
  _amount NUMERIC, _method TEXT, _account_name TEXT, _account_number TEXT
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
REVOKE ALL ON FUNCTION public.create_withdrawal(NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_withdrawal(NUMERIC, TEXT, TEXT, TEXT) TO authenticated;