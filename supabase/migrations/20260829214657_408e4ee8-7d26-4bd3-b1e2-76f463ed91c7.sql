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
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 250 THEN RAISE EXCEPTION 'Minimum withdrawal is 250 XAF'; END IF;
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

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.withdrawals%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Only pending withdrawals can be rejected'; END IF;

  UPDATE public.withdrawals SET status = 'rejected', reviewed_at = now() WHERE id = _id;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles SET balance = balance + w.amount WHERE id = w.user_id;

  INSERT INTO public.transactions(user_id, type, amount, description, ref_id)
  VALUES (w.user_id, 'withdrawal_refund'::public.transaction_type, w.amount, 'Withdrawal rejected — funds returned', w.id);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_withdrawal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid) TO authenticated, service_role;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions"
ON public.push_subscriptions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view push subscriptions"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.push_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  url text,
  created_by uuid,
  sent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.push_broadcasts TO authenticated;
GRANT ALL ON public.push_broadcasts TO service_role;
ALTER TABLE public.push_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read broadcasts"
ON public.push_broadcasts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can create broadcasts"
ON public.push_broadcasts FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT (id, announcement_enabled, announcement_title, announcement_message, announcement_link, announcement_link_label, announcement_version) ON public.app_settings TO anon, authenticated;

INSERT INTO public.plans (name, description, min_amount, max_amount, fixed_amount, amount_type, profit_type, fixed_daily_profit, daily_roi_percent, duration_days, payout_frequency, active)
VALUES ('FIDE 0', 'Entry plan', 1000, 1000, 1000, 'fixed', 'fixed', 50, 0, 30, 'daily', true);

CREATE TABLE public.mm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text text NOT NULL,
  sender text,
  txn_id text,
  txn_id_norm text,
  amount numeric,
  payer_number text,
  received_at timestamptz NOT NULL DEFAULT now(),
  matched_deposit_id uuid REFERENCES public.deposits(id),
  matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mm_messages TO authenticated;
GRANT ALL ON public.mm_messages TO service_role;
ALTER TABLE public.mm_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read mm_messages" ON public.mm_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX mm_messages_txn_id_norm_key ON public.mm_messages (txn_id_norm) WHERE txn_id_norm IS NOT NULL;
CREATE INDEX mm_messages_received_at_idx ON public.mm_messages (received_at DESC);

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS ocr_txn_id text,
  ADD COLUMN IF NOT EXISTS ocr_txn_id_norm text,
  ADD COLUMN IF NOT EXISTS ocr_amount numeric,
  ADD COLUMN IF NOT EXISTS ocr_payer text,
  ADD COLUMN IF NOT EXISTS ocr_raw jsonb,
  ADD COLUMN IF NOT EXISTS auto_note text,
  ADD COLUMN IF NOT EXISTS matched_message_id uuid REFERENCES public.mm_messages(id),
  ADD COLUMN IF NOT EXISTS auto_approved_at timestamptz;

CREATE INDEX IF NOT EXISTS deposits_ocr_txn_id_norm_idx ON public.deposits (ocr_txn_id_norm) WHERE ocr_txn_id_norm IS NOT NULL;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS auto_approve_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_approve_max_amount numeric,
  ADD COLUMN IF NOT EXISTS mm_webhook_secret text;

CREATE OR REPLACE FUNCTION public.auto_approve_deposit(_deposit_id uuid, _message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  m public.mm_messages%ROWTYPE;
  cap numeric;
  enabled boolean;
BEGIN
  SELECT auto_approve_enabled, auto_approve_max_amount INTO enabled, cap FROM public.app_settings WHERE id = 1;
  IF COALESCE(enabled, true) = false THEN
    RETURN jsonb_build_object('approved', false, 'reason', 'Auto-approval disabled');
  END IF;

  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('approved', false, 'reason', 'Deposit not found'); END IF;
  IF d.status <> 'pending' THEN RETURN jsonb_build_object('approved', false, 'reason', 'Deposit already reviewed'); END IF;

  SELECT * INTO m FROM public.mm_messages WHERE id = _message_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('approved', false, 'reason', 'Message not found'); END IF;
  IF m.matched_deposit_id IS NOT NULL AND m.matched_deposit_id <> _deposit_id THEN
    RETURN jsonb_build_object('approved', false, 'reason', 'Message already used');
  END IF;

  IF cap IS NOT NULL AND d.amount > cap THEN
    RETURN jsonb_build_object('approved', false, 'reason', 'Above auto-approval limit');
  END IF;

  IF m.amount IS NULL OR trunc(m.amount) <> trunc(d.amount) THEN
    RETURN jsonb_build_object('approved', false, 'reason', 'Amount mismatch');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.deposits x
    WHERE x.id <> d.id AND x.ocr_txn_id_norm IS NOT NULL
      AND x.ocr_txn_id_norm = m.txn_id_norm AND x.status = 'approved'
  ) THEN
    RETURN jsonb_build_object('approved', false, 'reason', 'Transaction ID already used');
  END IF;

  UPDATE public.deposits
    SET status = 'approved',
        reviewed_at = now(),
        auto_approved_at = now(),
        matched_message_id = m.id,
        auto_note = 'Auto-approved: transaction ID and amount matched operator message'
    WHERE id = d.id;

  UPDATE public.mm_messages SET matched_deposit_id = d.id, matched_at = now() WHERE id = m.id;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles SET balance = balance + d.amount WHERE id = d.user_id;

  INSERT INTO public.transactions(user_id, type, amount, description, ref_id)
  VALUES (d.user_id, 'deposit', d.amount, 'Deposit auto-approved', d.id);

  RETURN jsonb_build_object('approved', true, 'reason', 'Approved');
END;
$$;

REVOKE ALL ON FUNCTION public.auto_approve_deposit(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_approve_deposit(uuid, uuid) TO service_role;

REVOKE ALL ON public.mm_messages FROM anon;
REVOKE ALL ON public.mm_messages FROM authenticated;
GRANT SELECT ON public.mm_messages TO authenticated;
GRANT ALL ON public.mm_messages TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.balance := OLD.balance;
  NEW.total_invested := OLD.total_invested;
  NEW.total_earned := OLD.total_earned;
  NEW.referral_earnings := OLD.referral_earnings;
  NEW.kyc_status := OLD.kyc_status;
  NEW.is_suspended := OLD.is_suspended;
  NEW.referral_code := OLD.referral_code;
  NEW.referred_by := OLD.referred_by;
  NEW.id := OLD.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS auto_state text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS auto_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_note text,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_ref text;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS auto_withdraw_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_withdraw_max_amount numeric,
  ADD COLUMN IF NOT EXISTS auto_withdraw_ussd_template text NOT NULL DEFAULT '*126*9*{phone}*{amount}#';

CREATE INDEX IF NOT EXISTS withdrawals_auto_state_idx ON public.withdrawals (auto_state, status);

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
    RETURN jsonb_build_object('claimed', false, 'reason', 'Automatic withdrawal is disabled');
  END IF;
  tpl := COALESCE(NULLIF(s.auto_withdraw_ussd_template, ''), '*126*9*{phone}*{amount}#');

  UPDATE public.withdrawals
     SET auto_state = 'queued'
   WHERE auto_state = 'dispatched'
     AND status = 'pending'
     AND dispatched_at < now() - interval '10 minutes'
     AND auto_attempts < 3;

  SELECT * INTO w
    FROM public.withdrawals
   WHERE status = 'pending'
     AND auto_state = 'queued'
     AND (s.auto_withdraw_max_amount IS NULL OR amount <= s.auto_withdraw_max_amount)
   ORDER BY created_at
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF w IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'Nothing to pay');
  END IF;

  digits := regexp_replace(w.account_number, '[^0-9]', '', 'g');
  IF length(digits) > 9 THEN
    digits := right(digits, 9);
  END IF;

  code := replace(replace(tpl, '{phone}', digits), '{amount}', trunc(w.amount)::text);

  UPDATE public.withdrawals
     SET auto_state = 'dispatched',
         dispatched_at = now(),
         auto_attempts = auto_attempts + 1,
         auto_note = 'Sent to phone automation'
   WHERE id = w.id;

  RETURN jsonb_build_object(
    'claimed', true,
    'id', w.id,
    'phone', digits,
    'amount', trunc(w.amount),
    'account_name', w.account_name,
    'code', code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_auto_withdrawal(_id uuid, _ref text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w record;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Withdrawal not found');
  END IF;
  IF w.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Already reviewed');
  END IF;

  UPDATE public.withdrawals
     SET status = 'paid',
         reviewed_at = now(),
         auto_state = 'sent',
         operator_ref = _ref,
         auto_note = 'Paid automatically'
   WHERE id = _id;

  INSERT INTO public.transactions (user_id, type, amount, description, ref_id)
  VALUES (w.user_id, 'withdrawal', -trunc(w.amount), 'Withdrawal paid automatically (' || w.method || ')', w.id);

  RETURN jsonb_build_object('ok', true, 'user_id', w.user_id, 'amount', trunc(w.amount));
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_auto_withdrawal(_id uuid, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.withdrawals
     SET auto_state = 'failed',
         auto_note = COALESCE(_note, 'Automatic payout failed')
   WHERE id = _id AND status = 'pending';
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_auto_withdrawal() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_auto_withdrawal(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_auto_withdrawal(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_auto_withdrawal() TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_auto_withdrawal(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_auto_withdrawal(uuid, text) TO service_role;

alter table public.app_settings
  add column if not exists deposit_min_amount numeric not null default 1000,
  add column if not exists deposit_max_amount numeric not null default 10000000;

create or replace function public.reload_schema_cache()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'admin access required';
  end if;
  perform pg_notify('pgrst', 'reload schema');
end;
$$;

revoke all on function public.reload_schema_cache() from public, anon;
grant execute on function public.reload_schema_cache() to authenticated;

create table if not exists public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null,
  account_name text not null,
  account_number text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.payout_accounts enable row level security;

create policy "payout_accounts_select_own" on public.payout_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "payout_accounts_insert_own" on public.payout_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "payout_accounts_update_own" on public.payout_accounts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "payout_accounts_delete_own" on public.payout_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.payout_accounts to authenticated;
grant all on public.payout_accounts to service_role;

alter table public.app_settings
  add column if not exists mtn_number text,
  add column if not exists orange_number text,
  add column if not exists mtn_enabled boolean not null default false,
  add column if not exists orange_enabled boolean not null default false;

notify pgrst, 'reload schema';