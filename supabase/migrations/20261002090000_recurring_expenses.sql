-- v2: recurring expenses (rent, utilities, subscriptions).
--
-- recurring_expenses   a bill the user expects every month: its usual amount
--                      and the day it's normally paid. Nothing is added to
--                      `expenses` automatically; the app shows what's due and
--                      the user confirms each one with the real amount.
--   starts_on          the first day the bill counts from (no catching up on
--                      months before the user set it up).
--   skipped            months the user skipped, as 'YYYY-MM'.
-- expenses.recurring_id / recurring_period
--                      set on an expense created by confirming a bill, so the
--                      app knows that month is done. One expense per bill per
--                      month (the unique index). Deleting the bill keeps its
--                      past expenses.

CREATE TABLE public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text,
  category text NOT NULL,
  day_of_month smallint NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  active boolean NOT NULL DEFAULT true,
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  skipped text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recurring_expenses_user_idx ON public.recurring_expenses (user_id);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring expenses" ON public.recurring_expenses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own recurring expenses" ON public.recurring_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recurring expenses" ON public.recurring_expenses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recurring expenses" ON public.recurring_expenses
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.expenses
  ADD COLUMN recurring_id uuid REFERENCES public.recurring_expenses (id) ON DELETE SET NULL,
  ADD COLUMN recurring_period text;

CREATE UNIQUE INDEX expenses_recurring_once_idx
  ON public.expenses (recurring_id, recurring_period)
  WHERE recurring_id IS NOT NULL;
