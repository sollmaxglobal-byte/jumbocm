-- The Zendesk loader (src/components/ZendeskLoader.tsx) reads `zendesk_widget_key`
-- from the anonymous `public_settings` view, but the column was never added to the
-- view — PostgREST rejects the select with 400 (column not found). The widget key
-- is a public identifier embedded in the browser anyway (like tidio_public_key /
-- tawk_property_id), so expose it alongside the other public widget settings.

DROP VIEW IF EXISTS public.public_settings;
CREATE VIEW public.public_settings
WITH (security_invoker = false) AS
SELECT id, site_name, site_url, tidio_public_key, tawk_property_id, tawk_widget_id,
       sendpulse_chat_id, sendpulse_embed_html,
       announcement_enabled, announcement_title, announcement_message,
       announcement_link, announcement_link_label, announcement_version,
       deposit_min_amount, deposit_max_amount,
       withdraw_min_amount, withdraw_max_amount,
       mtn_number, orange_number, mtn_enabled, orange_enabled,
       referral_percent, korapay_enabled, nowpayments_enabled,
       zendesk_widget_key
FROM public.app_settings
WHERE id = 1;

GRANT SELECT ON public.public_settings TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
