-- v2: push notifications (the Monday weekly report).
--
-- push_subscriptions  one row per device a user turned notifications on for.
--                     The app adds and removes its own rows; the notify Edge
--                     Function (service role) reads them and removes devices
--                     the push service reports as gone.
-- notification_log    what was sent, so each week's report goes out once.
--                     Only the Edge Function uses it (RLS on, no policies).
-- profiles.timezone   the user's IANA time zone, so the report arrives at
--                     9:00 Monday where they are. Set by the app.
--
-- The schedule calls the function every hour. Its URL and secret are read
-- from Supabase Vault (secrets "notify_url" and "notify_cron_secret"), so no
-- secret is stored in this file.

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own devices" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own devices" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own devices" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.notification_log (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL,
  period_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, period_key)
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN timezone text;

-- Hourly schedule → the notify function.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'flux-o-notify',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_cron_secret')
    ),
    body := '{"job":"weekly"}'::jsonb
  );
  $$
);
