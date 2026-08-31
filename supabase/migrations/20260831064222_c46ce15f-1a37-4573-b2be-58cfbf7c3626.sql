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
        -- the caller asking about themselves (normal app + RLS path)
        _user_id = auth.uid()
        -- trusted internal callers: service role, or no API request context at all
        -- (pg_cron / direct database connections). Anonymous API callers always
        -- carry a request context with role 'anon', so they cannot reach this.
        OR coalesce(
             nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
             ''
           ) = 'service_role'
        OR nullif(current_setting('request.jwt.claims', true), '') IS NULL
      )
  );
$$;