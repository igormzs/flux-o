-- v2 / Phase 0: make EUR the main currency for new accounts.
--
-- Only changes the default for profiles created from now on. Existing
-- profiles keep whatever currency they already have.

ALTER TABLE public.profiles
  ALTER COLUMN currency SET DEFAULT 'EUR';
