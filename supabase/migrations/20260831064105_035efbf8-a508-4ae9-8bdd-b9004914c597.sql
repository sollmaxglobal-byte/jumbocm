-- 1. Harden has_role: only the database owner / service role may check another user's role.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (
        _user_id = auth.uid()
        OR (auth.uid() IS NULL AND current_user IN ('postgres', 'service_role', 'supabase_admin'))
      )
  );
$$;

-- 2. Private secret for the scheduled receipt-email endpoint.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS cron_secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex');

REVOKE ALL (cron_secret) ON public.app_settings FROM anon, authenticated;

-- 3. Scheduled job now authenticates with that secret.
SELECT cron.unschedule('process-receipt-emails')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-receipt-emails');

SELECT cron.schedule(
  'process-receipt-emails',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://jumbocm.lovable.app/api/public/process-receipt-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT cron_secret FROM public.app_settings WHERE id = 1)
    ),
    body := '{}'::jsonb
  );
  $job$
);