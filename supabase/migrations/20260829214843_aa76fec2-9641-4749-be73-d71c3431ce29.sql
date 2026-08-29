CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS withdrawal_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS transfer_pin_hash TEXT;

CREATE OR REPLACE FUNCTION public.set_security_pin(_kind TEXT, _pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,6}$' THEN RAISE EXCEPTION 'PIN must be 4 to 6 digits'; END IF;
  IF _kind NOT IN ('withdrawal','transfer') THEN RAISE EXCEPTION 'Invalid PIN type'; END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  IF _kind = 'withdrawal' THEN
    UPDATE public.profiles SET withdrawal_pin_hash = crypt(_pin, gen_salt('bf')) WHERE id = uid;
  ELSE
    UPDATE public.profiles SET transfer_pin_hash = crypt(_pin, gen_salt('bf')) WHERE id = uid;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_transfer_pin(_pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions
AS $$ SELECT public.set_security_pin('transfer', _pin); $$;

CREATE OR REPLACE FUNCTION public.can_withdraw(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE suspended boolean;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT is_suspended INTO suspended FROM public.profiles WHERE id = _user_id;
  IF suspended IS NULL OR suspended THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.investments WHERE user_id = _user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_withdrawal(
  _amount NUMERIC, _method TEXT, _account_name TEXT, _account_number TEXT, _pin TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE uid uuid := auth.uid(); stored text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT withdrawal_pin_hash INTO stored FROM public.profiles WHERE id = uid;
  IF stored IS NULL THEN RAISE EXCEPTION 'Set your withdrawal PIN first'; END IF;
  IF _pin IS NULL OR crypt(_pin, stored) <> stored THEN RAISE EXCEPTION 'Incorrect PIN'; END IF;
  IF NOT public.can_withdraw(uid) THEN RAISE EXCEPTION 'Withdrawals are unavailable for this account'; END IF;
  RETURN public.request_withdrawal(_amount, _method, _account_name, _account_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_transfer(
  _recipient_email TEXT, _amount NUMERIC, _pin TEXT, _note TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
  stored text;
  recipient uuid;
  cur numeric;
  clean_note text := left(trim(COALESCE(_note, '')), 160);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 100 OR _amount <> trunc(_amount) THEN
    RAISE EXCEPTION 'Enter a whole amount of at least 100 XAF';
  END IF;

  SELECT transfer_pin_hash, balance INTO stored, cur FROM public.profiles WHERE id = uid FOR UPDATE;
  IF stored IS NULL THEN RAISE EXCEPTION 'Set your transfer PIN first'; END IF;
  IF _pin IS NULL OR crypt(_pin, stored) <> stored THEN RAISE EXCEPTION 'Incorrect PIN'; END IF;
  IF cur IS NULL OR cur < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT id INTO recipient FROM auth.users WHERE lower(email) = lower(trim(_recipient_email)) LIMIT 1;
  IF recipient IS NULL THEN RAISE EXCEPTION 'No account found for that email'; END IF;
  IF recipient = uid THEN RAISE EXCEPTION 'You cannot transfer to yourself'; END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles SET balance = balance - _amount WHERE id = uid;
  UPDATE public.profiles SET balance = balance + _amount WHERE id = recipient;

  INSERT INTO public.transactions(user_id, type, amount, description)
  VALUES (uid, 'adjustment'::public.transaction_type, -_amount,
          'Transfer sent to ' || _recipient_email || CASE WHEN clean_note <> '' THEN ' — ' || clean_note ELSE '' END),
         (recipient, 'adjustment'::public.transaction_type, _amount,
          'Transfer received' || CASE WHEN clean_note <> '' THEN ' — ' || clean_note ELSE '' END);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_user_emails()
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY SELECT u.id, u.email::text FROM auth.users u WHERE u.email IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.set_security_pin(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.set_transfer_pin(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.create_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.create_transfer(TEXT, NUMERIC, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.can_withdraw(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_user_emails() FROM anon;

GRANT EXECUTE ON FUNCTION public.set_security_pin(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_transfer_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transfer(TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_withdraw(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_emails() TO authenticated;