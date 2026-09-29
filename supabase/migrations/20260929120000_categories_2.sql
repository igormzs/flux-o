-- v2 / Phase 1a: Categories 2.0 — edit, hide, delete and reorder categories.
--
-- v1 hard-coded the 8 default categories in the app, so they couldn't be
-- renamed, recolored or hidden, and custom categories couldn't be edited or
-- deleted at all.
--
-- Default categories stay in the app code (expenses keep pointing at them by
-- key, e.g. 'food'), but a user can now save an override row for one:
-- custom_categories.builtin_key = 'food' replaces its label, icon and color.
-- Every category also gets a sort position and can be hidden.

ALTER TABLE public.custom_categories
  ADD COLUMN builtin_key text
    CHECK (builtin_key IN ('food', 'grocery', 'rent', 'subscriptions', 'nightlife', 'utilities', 'selfcare', 'travel')),
  ADD COLUMN sort_order integer,
  ADD COLUMN hidden_at timestamptz,
  ADD CONSTRAINT custom_categories_user_builtin_key UNIQUE (user_id, builtin_key);

-- Counting and moving a category's expenses filters on these two columns.
CREATE INDEX IF NOT EXISTS expenses_user_category_idx ON public.expenses (user_id, category);

-- Deletes a category in one transaction: its expenses move to p_move_to
-- first, so none are left pointing at a category that no longer exists.
-- A default category is hidden instead of deleted (it lives in the app code),
-- so it can be restored later. Returns the number of expenses moved.
--
-- SECURITY INVOKER: runs with the caller's row-level security, so it can only
-- touch the caller's own rows.
CREATE OR REPLACE FUNCTION public.delete_category(p_category text, p_move_to text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_builtins text[] := ARRAY['food', 'grocery', 'rent', 'subscriptions', 'nightlife', 'utilities', 'selfcare', 'travel'];
  v_moved integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF p_move_to IS NOT NULL THEN
    IF p_move_to = p_category THEN
      RAISE EXCEPTION 'Choose a different category to move the expenses to';
    END IF;
    IF NOT (
      (p_move_to = ANY (v_builtins) AND NOT EXISTS (
        SELECT 1 FROM custom_categories
        WHERE user_id = v_uid AND builtin_key = p_move_to AND hidden_at IS NOT NULL))
      OR EXISTS (
        SELECT 1 FROM custom_categories
        WHERE user_id = v_uid AND id::text = p_move_to AND builtin_key IS NULL AND hidden_at IS NULL)
    ) THEN
      RAISE EXCEPTION 'The category to move expenses to does not exist';
    END IF;

    UPDATE expenses SET category = p_move_to
    WHERE user_id = v_uid AND category = p_category;
    GET DIAGNOSTICS v_moved = ROW_COUNT;
  ELSIF EXISTS (SELECT 1 FROM expenses WHERE user_id = v_uid AND category = p_category) THEN
    RAISE EXCEPTION 'This category still has expenses. Choose where to move them.';
  END IF;

  IF p_category = ANY (v_builtins) THEN
    -- The app saves the override row before calling this, so it exists.
    UPDATE custom_categories SET hidden_at = now()
    WHERE user_id = v_uid AND builtin_key = p_category;
  ELSE
    DELETE FROM custom_categories
    WHERE user_id = v_uid AND id::text = p_category AND builtin_key IS NULL;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  RETURN v_moved;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_category(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_category(text, text) TO authenticated;
