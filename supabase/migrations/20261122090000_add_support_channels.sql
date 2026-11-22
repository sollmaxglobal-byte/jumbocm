-- Support channels shown on the public Support (/contact) page. Admins set the
-- WhatsApp number and Telegram link in Admin → Settings → Support channels.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS support_whatsapp text,
  ADD COLUMN IF NOT EXISTS support_telegram text;

-- Recreate the anonymous view with the new columns. Keep every existing column:
-- dropping one silently breaks its loader (see the Zendesk widget incident).
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
       zendesk_widget_key, support_whatsapp, support_telegram
FROM public.app_settings
WHERE id = 1;

GRANT SELECT ON public.public_settings TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
