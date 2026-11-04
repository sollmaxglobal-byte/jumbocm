-- Investment plan upgrades.
--
-- A customer can switch an active investment to a higher plan. The upgrade is funded
-- only by deposited money (the investment's own principal plus deposit-origin wallet
-- balance); profit, ROI and referral bonuses are never eligible. When the deposited
-- funds fall short, the customer deposits exactly the shortfall and the upgrade is
-- applied automatically once that deposit is approved.

CREATE TABLE IF NOT EXISTS public.investment_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  target_plan_id uuid NOT NULL REFERENCES public.plans(id),
  target_amount numeric NOT NULL,
  deposit_shortfall numeric NOT NULL DEFAULT 0,
  deposit_id uuid REFERENCES public.deposits(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'awaiting_deposit',
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  result jsonb,
  CONSTRAINT investment_upgrades_status_check
    CHECK (status IN ('awaiting_deposit', 'applied', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS investment_upgrades_open_key
  ON public.investment_upgrades (investment_id)
  WHERE status = 'awaiting_deposit';

ALTER TABLE public.investment_upgrades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own upgrades" ON public.investment_upgrades;
CREATE POLICY "Users view own upgrades" ON public.investment_upgrades
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.investment_upgrades TO authenticated;

-- Deposit-origin wallet money: deposits and returned principal, minus money already
-- spent on investments and withdrawals. Profit, ROI, referral bonuses and admin
-- adjustments are deliberately excluded so they can never fund an upgrade.
CREATE OR REPLACE FUNCTION public.deposited_wallet_funds(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(t.amount), 0)
  FROM public.transactions t
  WHERE t.user_id = _user_id
    AND t.type IN (
      'deposit',
      'investment',
      'investment_return',
      'withdrawal',
      'withdrawal_hold',
      'withdrawal_refund'
    )
$$;

REVOKE ALL ON FUNCTION public.deposited_wallet_funds(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deposited_wallet_funds(uuid) TO service_role;

-- Quote for switching an active investment to another plan.
CREATE OR REPLACE FUNCTION public.investment_upgrade_quote(_investment_id uuid, _plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  inv RECORD;
  p RECORD;
  target numeric;
  bal numeric;
  wallet_funds numeric;
  wallet_used numeric;
  eligible numeric;
  shortfall numeric;
  pending_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO inv FROM public.investments WHERE id = _investment_id AND user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment not found'; END IF;
  IF inv.status <> 'active' THEN RAISE EXCEPTION 'Only active investments can be upgraded'; END IF;

  SELECT * INTO p FROM public.plans WHERE id = _plan_id AND COALESCE(active, true) = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found or inactive'; END IF;

  target := CASE WHEN COALESCE(p.amount_type, 'range') = 'fixed'
                 THEN p.fixed_amount ELSE p.min_amount END;

  IF target <= inv.amount THEN
    RAISE EXCEPTION 'Choose a higher plan than your current investment';
  END IF;

  SELECT COALESCE(balance, 0) INTO bal FROM public.profiles WHERE id = uid;
  wallet_funds := GREATEST(public.deposited_wallet_funds(uid), 0);
  wallet_used := LEAST(GREATEST(bal, 0), wallet_funds);
  eligible := inv.amount + wallet_used;
  shortfall := GREATEST(0, target - eligible);

  SELECT id INTO pending_id FROM public.investment_upgrades
   WHERE investment_id = inv.id AND status = 'awaiting_deposit';

  RETURN jsonb_build_object(
    'investment_id', inv.id,
    'current_plan_id', inv.plan_id,
    'current_amount', inv.amount,
    'plan_id', p.id,
    'plan_name', p.name,
    'target_amount', target,
    'daily_roi_percent', COALESCE(p.daily_roi_percent, 0),
    'duration_days', p.duration_days,
    'eligible_principal', inv.amount,
    'eligible_wallet', wallet_used,
    'eligible_total', eligible,
    'required_total', target,
    'wallet_needed', GREATEST(0, target - inv.amount),
    'shortfall', shortfall,
    'pending_upgrade_id', pending_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.investment_upgrade_quote(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.investment_upgrade_quote(uuid, uuid) TO authenticated;

-- Applies an upgrade row: switches the investment to the target plan, restarts its
-- term and charges only the extra amount from deposit-origin wallet funds.
-- Returns a jsonb verdict instead of raising, so a deferred deposit trigger can never
-- roll back the deposit settlement that invoked it.
CREATE OR REPLACE FUNCTION public.apply_investment_upgrade(_upgrade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u public.investment_upgrades%ROWTYPE;
  inv RECORD;
  p RECORD;
  bal numeric;
  invested numeric;
  wallet_funds numeric;
  wallet_needed numeric;
  tx_id uuid;
BEGIN
  SELECT * INTO u FROM public.investment_upgrades WHERE id = _upgrade_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'Upgrade not found'); END IF;
  IF u.status = 'applied' THEN RETURN jsonb_build_object('ok', true, 'status', 'applied'); END IF;
  IF u.status <> 'awaiting_deposit' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Upgrade is not open');
  END IF;

  SELECT * INTO inv FROM public.investments
   WHERE id = u.investment_id AND user_id = u.user_id FOR UPDATE;
  IF NOT FOUND OR inv.status <> 'active' THEN
    UPDATE public.investment_upgrades SET status = 'cancelled' WHERE id = u.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'Investment is no longer active');
  END IF;

  SELECT * INTO p FROM public.plans WHERE id = u.target_plan_id;
  IF NOT FOUND THEN
    UPDATE public.investment_upgrades SET status = 'cancelled' WHERE id = u.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'Target plan no longer exists');
  END IF;

  SELECT balance, total_invested INTO bal, invested
    FROM public.profiles WHERE id = u.user_id FOR UPDATE;

  wallet_needed := GREATEST(0, u.target_amount - inv.amount);
  wallet_funds := LEAST(
    GREATEST(COALESCE(bal, 0), 0),
    GREATEST(public.deposited_wallet_funds(u.user_id), 0)
  );

  IF wallet_funds < wallet_needed THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'Insufficient deposited funds',
      'shortfall', wallet_needed - wallet_funds
    );
  END IF;

  UPDATE public.investments
     SET plan_id = u.target_plan_id,
         amount = u.target_amount,
         daily_roi_percent = COALESCE(p.daily_roi_percent, 0),
         duration_days = p.duration_days,
         start_date = now(),
         end_date = now() + (p.duration_days || ' days')::interval,
         last_payout_at = NULL
   WHERE id = inv.id;

  IF wallet_needed > 0 THEN
    PERFORM set_config('app.bypass_profile_guard', 'on', true);
    UPDATE public.profiles
       SET balance = COALESCE(bal, 0) - wallet_needed,
           total_invested = COALESCE(invested, 0) + wallet_needed
     WHERE id = u.user_id;
    PERFORM set_config('app.bypass_profile_guard', 'off', true);

    INSERT INTO public.transactions(user_id, type, amount, description, ref_id)
    VALUES (u.user_id, 'investment', -wallet_needed, 'Upgraded to ' || p.name, inv.id)
    RETURNING id INTO tx_id;
  END IF;

  UPDATE public.investment_upgrades
     SET status = 'applied',
         applied_at = now(),
         result = jsonb_build_object(
           'investment_id', inv.id,
           'plan_id', p.id,
           'plan_name', p.name,
           'amount', u.target_amount,
           'wallet_used', wallet_needed,
           'transaction_id', tx_id
         )
   WHERE id = u.id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'applied',
    'investment_id', inv.id,
    'plan_name', p.name,
    'amount', u.target_amount,
    'wallet_used', wallet_needed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_investment_upgrade(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_investment_upgrade(uuid) TO service_role;

-- Confirms an upgrade straight away. Raises when deposit-origin funds are short, so
-- the caller must collect the difference through the deposit flow instead.
CREATE OR REPLACE FUNCTION public.upgrade_investment(_investment_id uuid, _plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  q jsonb;
  upgrade_id uuid;
  res jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  q := public.investment_upgrade_quote(_investment_id, _plan_id);
  IF (q ->> 'shortfall')::numeric > 0 THEN
    RAISE EXCEPTION 'Insufficient deposited funds: % XAF needed', (q ->> 'shortfall')::numeric;
  END IF;

  INSERT INTO public.investment_upgrades(
    user_id, investment_id, target_plan_id, target_amount, deposit_shortfall, status
  ) VALUES (
    uid, _investment_id, _plan_id, (q ->> 'target_amount')::numeric, 0, 'awaiting_deposit'
  )
  ON CONFLICT (investment_id) WHERE status = 'awaiting_deposit'
  DO UPDATE SET target_plan_id = EXCLUDED.target_plan_id,
                target_amount = EXCLUDED.target_amount,
                deposit_shortfall = 0,
                created_at = now()
  RETURNING id INTO upgrade_id;

  res := public.apply_investment_upgrade(upgrade_id);
  IF COALESCE((res ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(res ->> 'reason', 'Could not apply the upgrade');
  END IF;
  RETURN res;
END;
$$;

REVOKE ALL ON FUNCTION public.upgrade_investment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upgrade_investment(uuid, uuid) TO authenticated;

-- Opens (or refreshes) a pending upgrade and reports the deposit shortfall the
-- customer has to pay. Applies immediately when the wallet already covers it.
CREATE OR REPLACE FUNCTION public.begin_investment_upgrade(_investment_id uuid, _plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  q jsonb;
  shortfall numeric;
  upgrade_id uuid;
  res jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  q := public.investment_upgrade_quote(_investment_id, _plan_id);
  shortfall := (q ->> 'shortfall')::numeric;

  INSERT INTO public.investment_upgrades(
    user_id, investment_id, target_plan_id, target_amount, deposit_shortfall, status
  ) VALUES (
    uid, _investment_id, _plan_id, (q ->> 'target_amount')::numeric, shortfall, 'awaiting_deposit'
  )
  ON CONFLICT (investment_id) WHERE status = 'awaiting_deposit'
  DO UPDATE SET target_plan_id = EXCLUDED.target_plan_id,
                target_amount = EXCLUDED.target_amount,
                deposit_shortfall = EXCLUDED.deposit_shortfall,
                deposit_id = NULL,
                created_at = now()
  RETURNING id INTO upgrade_id;

  IF shortfall <= 0 THEN
    res := public.apply_investment_upgrade(upgrade_id);
    RETURN q || COALESCE(res, '{}'::jsonb) || jsonb_build_object('upgrade_id', upgrade_id);
  END IF;

  RETURN q || jsonb_build_object(
    'ok', true,
    'status', 'awaiting_deposit',
    'upgrade_id', upgrade_id,
    'deposit_amount', shortfall
  );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_investment_upgrade(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_investment_upgrade(uuid, uuid) TO authenticated;

-- Links the deposit the customer is paying to an open upgrade, so approving that
-- deposit completes the upgrade. Accepts either the deposit id or its reference.
CREATE OR REPLACE FUNCTION public.link_upgrade_deposit(
  _upgrade_id uuid,
  _deposit_id uuid DEFAULT NULL,
  _reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  d_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.investment_upgrades
     WHERE id = _upgrade_id AND user_id = uid AND status = 'awaiting_deposit'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Upgrade is not open');
  END IF;

  IF _deposit_id IS NOT NULL THEN
    SELECT id INTO d_id FROM public.deposits WHERE id = _deposit_id AND user_id = uid;
  ELSIF _reference IS NOT NULL THEN
    SELECT id INTO d_id FROM public.deposits WHERE reference = _reference AND user_id = uid;
  END IF;

  IF d_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'Deposit not found'); END IF;

  UPDATE public.investment_upgrades SET deposit_id = d_id WHERE id = _upgrade_id;
  RETURN jsonb_build_object('ok', true, 'deposit_id', d_id);
END;
$$;

REVOKE ALL ON FUNCTION public.link_upgrade_deposit(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_upgrade_deposit(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_investment_upgrade(_upgrade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.investment_upgrades
     SET status = 'cancelled'
   WHERE id = _upgrade_id AND user_id = uid AND status = 'awaiting_deposit';
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_investment_upgrade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_investment_upgrade(uuid) TO authenticated;

-- Deposit approval is a single transaction: the deposit flips to approved, the wallet
-- is credited and the ledger row is written together, so the deferred upgrade trigger
-- below always sees the settled balance.
CREATE OR REPLACE FUNCTION public.review_deposit(_deposit_id uuid, _approve boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deposits%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit not found'; END IF;
  IF d.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Deposit already reviewed');
  END IF;

  IF _approve THEN
    UPDATE public.deposits SET status = 'approved', reviewed_at = now() WHERE id = d.id;

    PERFORM set_config('app.bypass_profile_guard', 'on', true);
    UPDATE public.profiles SET balance = balance + d.amount WHERE id = d.user_id;
    PERFORM set_config('app.bypass_profile_guard', 'off', true);

    INSERT INTO public.transactions(user_id, type, amount, description, ref_id)
    VALUES (d.user_id, 'deposit', d.amount, 'Deposit approved', d.id);

    RETURN jsonb_build_object('ok', true, 'status', 'approved', 'amount', d.amount, 'user_id', d.user_id);
  END IF;

  UPDATE public.deposits SET status = 'rejected', reviewed_at = now() WHERE id = d.id;
  UPDATE public.investment_upgrades
     SET status = 'cancelled'
   WHERE deposit_id = d.id AND status = 'awaiting_deposit';

  RETURN jsonb_build_object('ok', true, 'status', 'rejected', 'amount', d.amount, 'user_id', d.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.review_deposit(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_deposit(uuid, boolean) TO authenticated;

-- Completes any upgrade waiting on a deposit as soon as that deposit is approved.
-- Deferred so every settlement path (admin review, auto-approval, gateways) finishes
-- crediting the wallet before eligibility is evaluated. Idempotent: an applied upgrade
-- is never charged twice.
CREATE OR REPLACE FUNCTION public.apply_upgrade_after_deposit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u RECORD;
BEGIN
  IF NEW.status = 'approved' AND COALESCE(OLD.status, '') <> 'approved' THEN
    FOR u IN
      SELECT id FROM public.investment_upgrades
       WHERE deposit_id = NEW.id AND status = 'awaiting_deposit'
    LOOP
      PERFORM public.apply_investment_upgrade(u.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_upgrade_after_deposit ON public.deposits;
CREATE CONSTRAINT TRIGGER trg_apply_upgrade_after_deposit
  AFTER UPDATE OF status ON public.deposits
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_upgrade_after_deposit();
