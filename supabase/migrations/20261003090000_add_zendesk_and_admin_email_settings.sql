-- The admin settings form reads and writes `zendesk_widget_key` and `admin_email`,
-- but these columns were never part of the schema. PostgREST rejects the whole
-- UPDATE with PGRST204 ("Could not find the ... column ... in the schema cache"),
-- so *every* save on the admin settings page failed and no setting — including
-- referral_percent — ever persisted.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS zendesk_widget_key text,
  ADD COLUMN IF NOT EXISTS admin_email text;
