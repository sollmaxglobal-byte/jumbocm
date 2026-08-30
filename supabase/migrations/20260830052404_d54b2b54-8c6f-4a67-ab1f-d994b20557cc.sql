-- Safe, non-sensitive settings columns readable by the app
GRANT SELECT (
  id, site_name, site_url,
  tidio_public_key, sendpulse_chat_id, sendpulse_embed_html,
  tawk_property_id, tawk_widget_id,
  referral_percent,
  announcement_enabled, announcement_title, announcement_message,
  announcement_link, announcement_link_label, announcement_version,
  deposit_min_amount, deposit_max_amount,
  mtn_number, orange_number, mtn_enabled, orange_enabled,
  updated_at
) ON public.app_settings TO anon, authenticated;

GRANT UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
