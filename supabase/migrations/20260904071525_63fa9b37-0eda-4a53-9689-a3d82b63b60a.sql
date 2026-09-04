DROP POLICY IF EXISTS "Anon and users read app_settings row" ON public.app_settings;

DROP VIEW IF EXISTS public.public_settings;

CREATE VIEW public.public_settings
WITH (security_invoker = false) AS
SELECT
  id,
  site_name,
  site_url,
  tidio_public_key,
  sendpulse_chat_id,
  sendpulse_embed_html,
  tawk_property_id,
  tawk_widget_id,
  announcement_enabled,
  announcement_title,
  announcement_message,
  announcement_link,
  announcement_link_label,
  announcement_version,
  deposit_min_amount,
  deposit_max_amount,
  mtn_number,
  orange_number,
  mtn_enabled,
  orange_enabled,
  referral_percent
FROM public.app_settings;

GRANT SELECT ON public.public_settings TO anon, authenticated;