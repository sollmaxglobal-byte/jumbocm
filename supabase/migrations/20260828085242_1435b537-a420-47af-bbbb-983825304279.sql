
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "Anyone view proofs" ON storage.objects;
DROP POLICY IF EXISTS "Owners and admins view proofs" ON storage.objects;
CREATE POLICY "Owners and admins view proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE TABLE IF NOT EXISTS public.app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  tidio_public_key TEXT,
  site_name TEXT NOT NULL DEFAULT 'Camvcc',
  site_url TEXT,
  smtp_host TEXT,
  smtp_port INT DEFAULT 465,
  smtp_secure BOOLEAN DEFAULT true,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_from_name TEXT,
  smtp_from_email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT only_one_row CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read app_settings" ON public.app_settings;
CREATE POLICY "Admins read app_settings" ON public.app_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update app_settings" ON public.app_settings;
CREATE POLICY "Admins update app_settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.public_settings
WITH (security_invoker = true) AS
SELECT id, tidio_public_key, site_name, site_url FROM public.app_settings;
GRANT SELECT ON public.public_settings TO anon, authenticated;

DROP POLICY IF EXISTS "Public reads branding" ON public.app_settings;
CREATE POLICY "Public reads branding" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.email_templates (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage templates" ON public.email_templates;
CREATE POLICY "Admins manage templates" ON public.email_templates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  template_key TEXT,
  subject TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read email_logs" ON public.email_logs;
CREATE POLICY "Admins read email_logs" ON public.email_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.deposits ALTER COLUMN reference DROP NOT NULL;


ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

UPDATE public.profiles
SET referral_code = upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS payer_phone text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, referral_code)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    upper(substr(replace(NEW.id::text, '-', ''), 1, 8))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS sendpulse_chat_id text;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS profit_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS fixed_daily_profit numeric NOT NULL DEFAULT 0;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_profit_type_check;
ALTER TABLE public.plans ADD CONSTRAINT plans_profit_type_check CHECK (profit_type IN ('percent','fixed'));

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS payout_frequency text NOT NULL DEFAULT 'end_of_term' CHECK (payout_frequency IN ('daily','weekly','monthly','end_of_term'));
