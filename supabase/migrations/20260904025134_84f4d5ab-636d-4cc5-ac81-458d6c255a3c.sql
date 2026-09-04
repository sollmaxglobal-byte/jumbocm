-- 1) Let the second profile guard honour the server-side bypass flag
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.bypass_profile_guard', true) = 'on'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_role) THEN
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
$function$;

-- 2) One-time reconciliation from the ledger.
-- Duplicate 'withdrawal' rows that shadow an existing 'withdrawal_hold' for the
-- same request are excluded so held funds are only counted once.
WITH ledger AS (
  SELECT t.user_id, SUM(t.amount) AS net
  FROM public.transactions t
  WHERE NOT (
    t.type = 'withdrawal'::public.transaction_type
    AND t.ref_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.transactions h
      WHERE h.ref_id = t.ref_id
        AND h.type = 'withdrawal_hold'::public.transaction_type
    )
  )
  GROUP BY t.user_id
),
inv AS (
  SELECT user_id, SUM(amount) AS invested
  FROM public.investments
  GROUP BY user_id
)
UPDATE public.profiles p
SET balance = GREATEST(COALESCE(l.net, 0), 0),
    total_invested = COALESCE(i.invested, 0),
    updated_at = now()
FROM (SELECT id FROM public.profiles) ids
LEFT JOIN ledger l ON l.user_id = ids.id
LEFT JOIN inv i ON i.user_id = ids.id
WHERE p.id = ids.id;
