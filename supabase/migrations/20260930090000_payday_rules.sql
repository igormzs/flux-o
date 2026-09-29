-- v2 / Phase 1b: "My cycle is 25th to 25th, but payday moves."
--
-- Two ways a cycle can start on a different day than billing_cycle_day:
--   payday_weekend_rule   - every cycle: when the cycle day is a Saturday or
--                           Sunday, start on the Friday before ('before'), the
--                           Monday after ('after'), or keep it ('none').
--   cycle_start_overrides - one cycle: {"2026-09": "2026-09-23"} means the
--                           cycle usually starting in Sep 2026 started on the
--                           23rd. The app allows at most 10 days either way.

ALTER TABLE public.profiles
  ADD COLUMN payday_weekend_rule text NOT NULL DEFAULT 'none'
    CHECK (payday_weekend_rule IN ('none', 'before', 'after')),
  ADD COLUMN cycle_start_overrides jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(cycle_start_overrides) = 'object');
