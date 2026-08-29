CREATE OR REPLACE FUNCTION public.profiles_prevent_privileged_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bypass_profile_guard', true) = 'on'
     OR public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL THEN
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

CREATE OR REPLACE FUNCTION public.activate_investment_v2(_plan_id uuid, _amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur_balance numeric;
  cur_invested numeric;
  p RECORD;
  new_inv_id uuid;
  new_tx_id uuid;
  min_a numeric;
  max_a numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  SELECT * INTO p FROM public.plans WHERE id = _plan_id AND COALESCE(active, true) = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found or inactive'; END IF;

  IF COALESCE(p.amount_type, 'range') = 'fixed' THEN
    min_a := p.fixed_amount; max_a := p.fixed_amount;
  ELSE
    min_a := p.min_amount; max_a := p.max_amount;
  END IF;

  IF _amount < min_a OR _amount > max_a THEN
    RAISE EXCEPTION 'Amount must be between % and % XAF', min_a, max_a;
  END IF;

  SELECT balance, total_invested INTO cur_balance, cur_invested
    FROM public.profiles WHERE id = uid FOR UPDATE;
  IF cur_balance IS NULL OR cur_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  INSERT INTO public.investments(user_id, plan_id, amount, daily_roi_percent, duration_days, end_date, status)
    VALUES (uid, _plan_id, _amount, COALESCE(p.daily_roi_percent, 0), p.duration_days,
            now() + (p.duration_days || ' days')::interval, 'active')
    RETURNING id INTO new_inv_id;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles
    SET balance = cur_balance - _amount,
        total_invested = COALESCE(cur_invested, 0) + _amount
    WHERE id = uid;
  PERFORM set_config('app.bypass_profile_guard', 'off', true);

  INSERT INTO public.transactions(user_id, type, amount, description, ref_id)
    VALUES (uid, 'investment', -_amount, 'Activated ' || p.name, new_inv_id)
    RETURNING id INTO new_tx_id;

  RETURN jsonb_build_object(
    'investment_id', new_inv_id,
    'transaction_id', new_tx_id,
    'plan_name', p.name,
    'amount', _amount,
    'duration_days', p.duration_days
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_investment_v2(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_investment_v2(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_investment(_plan_id uuid, _amount numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
BEGIN
  res := public.activate_investment_v2(_plan_id, _amount);
  RETURN (res->>'investment_id')::uuid;
END;
$$;

ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'both';
ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_scope_check;
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_scope_check CHECK (scope IN ('deposit','withdrawal','both'));
UPDATE public.app_settings SET site_url = 'https://fidelity-invest.lovable.app' WHERE id = 1 AND (site_url IS NULL OR site_url = '');

INSERT INTO public.email_templates (key, name, subject, html_body, enabled)
VALUES (
'withdrawal_approved',
'Withdrawal approved',
'✅ Your withdrawal has been approved — Reference #{{transaction_id}}',
'<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;line-height:1.55">
  <div style="background:#065f46;color:#fff;padding:22px 24px;border-radius:12px 12px 0 0">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.8">{{site_name}}</div>
    <h1 style="margin:6px 0 0;font-size:22px">Withdrawal approved</h1>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:24px">
    <p>Hello {{name}},</p>
    <p>Good news — your withdrawal request has been reviewed and <strong>approved</strong>. Payment is being sent to the account below and should arrive within 10 minutes.</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
      <tr><td style="padding:8px 0;color:#6b7280">Transaction ID</td><td style="padding:8px 0;text-align:right;font-weight:bold">#{{transaction_id}}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Amount</td><td style="padding:8px 0;text-align:right;font-weight:bold">{{amount}} XAF</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Method</td><td style="padding:8px 0;text-align:right">{{method}}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Account</td><td style="padding:8px 0;text-align:right">{{account}}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;text-align:right">{{date}}</td></tr>
    </table>
    <p style="text-align:center;margin:26px 0">
      <a href="{{site_url}}/dashboard/wallet" style="background:#065f46;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">View transaction history</a>
    </p>
    <p style="font-size:12px;color:#6b7280">Please keep transaction ID <strong>#{{transaction_id}}</strong> for your records. If you did not request this withdrawal, contact support immediately at {{site_url}}.</p>
  </div>
</div>',
true)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE inv RECORD;
BEGIN
  SELECT * INTO inv FROM public.investments WHERE id = '55f0a81c-fcfa-4e04-82b3-af01068932a5';
  IF FOUND THEN
    PERFORM set_config('app.bypass_profile_guard', 'on', true);
    UPDATE public.profiles SET balance = balance + inv.amount WHERE id = inv.user_id;
    DELETE FROM public.transactions WHERE ref_id = inv.id;
    DELETE FROM public.investments WHERE id = inv.id;
  END IF;
END $$;

create or replace function public.referrer_name(_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.full_name from public.profiles p
  where p.referral_code is not null
    and lower(p.referral_code) = lower(trim(_code))
  limit 1
$$;

grant execute on function public.referrer_name(text) to anon, authenticated;

update public.email_templates
set subject = '💸 Withdrawal paid — {{amount}} XAF sent (Ref #{{transaction_id}})',
    html_body = '<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e9ef">
    <div style="background:#0b2540;padding:20px 24px;color:#ffffff">
      <div style="font-size:20px;font-weight:bold">{{site_name}}</div>
      <div style="font-size:13px;opacity:.8">Payout confirmation</div>
    </div>
    <div style="padding:24px;color:#1c2733;font-size:15px;line-height:1.6">
      <p>Hello {{name}},</p>
      <p>Your withdrawal of <strong>{{amount}} XAF</strong> has been <strong>paid</strong> and sent to the payout account you provided. Depending on your provider, funds usually arrive within a few minutes.</p>

      <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
        <tr><td style="padding:8px 0;color:#6b7280">Transaction reference</td><td style="padding:8px 0;text-align:right"><strong>#{{transaction_id}}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Amount paid</td><td style="padding:8px 0;text-align:right"><strong>{{amount}} XAF</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Status</td><td style="padding:8px 0;text-align:right"><strong>PAID</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;text-align:right">{{date}}</td></tr>
      </table>

      <div style="background:#f0f7f3;border:1px solid #cfe6da;border-radius:10px;padding:16px;margin:18px 0">
        <div style="font-weight:bold;color:#0b2540;margin-bottom:8px">Payout account details</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#6b7280">Payout method</td><td style="padding:6px 0;text-align:right"><strong>{{method}}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Account name</td><td style="padding:6px 0;text-align:right"><strong>{{account_name}}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Account / number</td><td style="padding:6px 0;text-align:right"><strong>{{account_number}}</strong></td></tr>
        </table>
      </div>

      <p>If you do not see the funds after 30 minutes, reply to this email or contact support with reference <strong>#{{transaction_id}}</strong>.</p>
      <p style="margin:24px 0">
        <a href="{{site_url}}/dashboard/wallet" style="background:#0b2540;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block">View my wallet</a>
      </p>
      <p style="color:#6b7280;font-size:13px">Never share your password or one-time codes. {{site_name}} staff will never ask for them.</p>
    </div>
    <div style="background:#f4f6f8;padding:16px 24px;color:#6b7280;font-size:12px">
      {{site_name}} · Douala, Cameroon<br/>Investments carry risk. Only invest what you can afford to lose.
    </div>
  </div>
</div>'
where key = 'withdrawal_paid';