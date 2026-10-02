DROP VIEW IF EXISTS public.public_settings;

CREATE VIEW public.public_settings
WITH (security_invoker = true) AS
SELECT id, site_name, site_url, tidio_public_key, tawk_property_id, tawk_widget_id,
       sendpulse_chat_id, sendpulse_embed_html,
       announcement_enabled, announcement_title, announcement_message,
       announcement_link, announcement_link_label, announcement_version,
       deposit_min_amount, deposit_max_amount,
       mtn_number, orange_number, mtn_enabled, orange_enabled,
       referral_percent, korapay_enabled
FROM public.app_settings
WHERE id = 1;

GRANT SELECT ON public.public_settings TO anon, authenticated;

GRANT SELECT (id, site_name, site_url, tidio_public_key, tawk_property_id, tawk_widget_id,
       sendpulse_chat_id, sendpulse_embed_html,
       announcement_enabled, announcement_title, announcement_message,
       announcement_link, announcement_link_label, announcement_version,
       deposit_min_amount, deposit_max_amount,
       mtn_number, orange_number, mtn_enabled, orange_enabled,
       referral_percent, korapay_enabled)
  ON public.app_settings TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read safe settings columns" ON public.app_settings;
CREATE POLICY "Public can read safe settings columns"
ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (id = 1);