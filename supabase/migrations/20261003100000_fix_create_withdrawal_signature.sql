-- Withdrawal requests failed with:
--   Could not find the function public.create_withdrawal(_account_name, _account_number, _amount, _method)
--
-- The PIN confirmation step was removed from the withdraw page (client now calls
-- create_withdrawal with four arguments), but the database only ever had the
-- five-argument, PIN-gated version created in
-- 20260829214843_aa76fec2-...sql. PostgREST therefore reported PGRST202 for the
-- four-argument call and no withdrawal could be submitted.
--
-- Restore the four-argument signature the client and generated types expect, and
-- drop the unused PIN-gated overload so there is a single source of truth.

CREATE OR REPLACE FUNCTION public.create_withdrawal(
  _amount NUMERIC, _method TEXT, _account_name TEXT, _account_number TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_withdraw(uid) THEN
    RAISE EXCEPTION 'Withdrawals are unavailable for this account';
  END IF;
  RETURN public.request_withdrawal(_amount, _method, _account_name, _account_number);
END;
$$;

DROP FUNCTION IF EXISTS public.create_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT);

REVOKE ALL ON FUNCTION public.create_withdrawal(NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_withdrawal(NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Ask PostgREST to refresh its schema cache so the restored signature is visible immediately.
NOTIFY pgrst, 'reload schema';
