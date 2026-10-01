ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS zendesk_widget_key TEXT;

CREATE OR REPLACE VIEW public.public_settings
WITH (security_invoker = true) AS
SELECT id, site_name, site_url, tidio_public_key, tawk_property_id, tawk_widget_id,
       sendpulse_chat_id, sendpulse_embed_html,
       announcement_enabled, announcement_title, announcement_message,
       announcement_link, announcement_link_label, announcement_version,
       deposit_min_amount, deposit_max_amount,
       mtn_number, orange_number, mtn_enabled, orange_enabled,
       referral_percent, korapay_enabled, zendesk_widget_key
FROM public.app_settings
WHERE id = 1;

GRANT SELECT ON public.public_settings TO anon, authenticated;
GRANT SELECT (zendesk_widget_key) ON public.app_settings TO anon, authenticated;
COMMENT ON COLUMN public.app_settings.zendesk_widget_key IS 'Public Zendesk Web Widget key or installation snippet; safe for client-side loading.';