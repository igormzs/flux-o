-- v2 / Phase 0: give each expense a real currency column.
--
-- v1 stored an expense's currency inside its note as a text prefix
-- ("[EUR] Weekend trip") and parsed it back out with a regex. Totals then
-- added EUR and USD amounts together as if they were the same currency.
--
-- This moves the prefix into expenses.currency and strips it from the note.
-- NULL means "the user's main currency" (profiles.currency), which was also
-- v1's behaviour for notes without a prefix.

ALTER TABLE public.expenses
  ADD COLUMN currency text CHECK (currency ~ '^[A-Z]{3}$');

UPDATE public.expenses
SET
  currency = substring(note FROM '^\[([A-Z]{3})\]'),
  note = nullif(regexp_replace(note, '^\[[A-Z]{3}\]\s?', ''), '')
WHERE note ~ '^\[[A-Z]{3}\]';
