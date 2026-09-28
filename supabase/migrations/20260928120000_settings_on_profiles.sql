-- v2 / Phase 0: move app settings from the browser into the database.
--
-- In v1, settings (budget goal, currency, billing-cycle day, display period,
-- notification toggles) were kept only in localStorage ("fluxo_settings"),
-- so every device had its own copy and nothing synced between phone and
-- desktop. They now live on the user's profile row.
--
-- settings_migrated_at is set the first time a device uploads its old
-- localStorage settings, so a second device with stale local settings can't
-- overwrite them later.

ALTER TABLE public.profiles
  ADD COLUMN currency text NOT NULL DEFAULT 'USD'
    CHECK (currency ~ '^[A-Z]{3}$'),
  ADD COLUMN budget_goal numeric NOT NULL DEFAULT 2000
    CHECK (budget_goal >= 0),
  ADD COLUMN billing_cycle_day smallint NOT NULL DEFAULT 25
    CHECK (billing_cycle_day BETWEEN 1 AND 31),
  ADD COLUMN default_scope text NOT NULL DEFAULT 'cycle'
    CHECK (default_scope IN ('cycle', 'month', 'week', 'last30', 'all')),
  ADD COLUMN week_starts_on smallint NOT NULL DEFAULT 1
    CHECK (week_starts_on IN (0, 1)),
  ADD COLUMN notifications jsonb NOT NULL
    DEFAULT '{"overBudget": true, "weeklyReport": false, "dailyReminder": false}'::jsonb,
  ADD COLUMN settings_migrated_at timestamptz;

-- Keep profiles.updated_at current, like expenses already does.
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
