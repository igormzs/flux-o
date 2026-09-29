import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "./date-utils";
import { DEFAULT_CATEGORIES, isBuiltinKey } from "./categories";

export interface Expense {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  category: string;
  custom_category_id: string | null;
  /** ISO code; null means the user's main currency. */
  currency: string | null;
  note: string | null;
  image_url: string | null;
  date: string;
  created_at: string;
  updated_at: string;
}

/**
 * A row of `custom_categories`: either a category the user created, or (when
 * `builtin_key` is set) the user's saved changes to a default category.
 */
export interface CustomCategory {
  id: string;
  user_id: string;
  label: string;
  icon: string;
  color: string;
  created_at: string;
  /** Set when this row overrides a default category, e.g. "food". */
  builtin_key?: string | null;
  /** Position in the user's list; null until the user reorders. */
  sort_order?: number | null;
  /** Hidden categories stay resolvable but aren't offered in pickers. */
  hidden_at?: string | null;
}

export interface ExpenseInput {
  title: string;
  amount: number;
  category: string;
  currency?: string | null;
  custom_category_id?: string | null;
  note?: string | null;
  image_url?: string | null;
  date: string;
}

/** Expenses with `range.start <= date < range.end`, newest first. */
export async function getExpensesInRange(range: DateRange) {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .gte("date", range.start.toISOString())
    .lt("date", range.end.toISOString())
    .order("date", { ascending: false });
  if (error) throw error;
  return data as Expense[];
}

export async function getRecentExpenses(limit: number) {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Expense[];
}

export async function saveExpense(expense: ExpenseInput) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("expenses")
    .insert({ ...expense, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function updateExpense(id: string, expense: ExpenseInput) {
  const { data, error } = await supabase
    .from("expenses")
    .update(expense)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

/** Phase 2: many expenses in one request (one insert, all or nothing). */
export async function saveExpenses(expenses: ExpenseInput[]) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("expenses")
    .insert(expenses.map((e) => ({ ...e, user_id: userId })))
    .select("id");
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

/** Undo for a batch save. */
export async function deleteExpenses(ids: string[]) {
  const { error } = await supabase.from("expenses").delete().in("id", ids);
  if (error) throw error;
}

/** Titles and categories of recent expenses, used to guess the category of new ones. */
export async function getExpenseHistory(limit = 1000) {
  const { data, error } = await supabase
    .from("expenses")
    .select("title, category")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as { title: string; category: string }[];
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function getCustomCategories() {
  const { data, error } = await supabase
    .from("custom_categories")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as CustomCategory[];
}

export interface CategoryLook {
  label: string;
  icon: string;
  color: string;
}

async function requireUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function createCustomCategory(category: CategoryLook & { sort_order?: number }) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("custom_categories")
    .insert({ ...category, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as CustomCategory;
}

/**
 * Saves a category's label, icon and color. A default category ("food") gets
 * an override row keyed by builtin_key; a custom one is updated in place.
 */
export async function updateCategory(id: string, look: CategoryLook) {
  if (!isBuiltinKey(id)) {
    const { error } = await supabase.from("custom_categories").update(look).eq("id", id);
    if (error) throw error;
    return;
  }
  const userId = await requireUserId();
  const { error } = await supabase
    .from("custom_categories")
    .upsert({ ...look, user_id: userId, builtin_key: id }, { onConflict: "user_id,builtin_key" });
  if (error) throw error;
}

/**
 * Creates override rows for the default categories that don't have one yet,
 * with their current look, so they can be hidden or given a position.
 */
async function ensureBuiltinRows(keys: string[], rows: CustomCategory[]) {
  const missing = keys.filter((k) => isBuiltinKey(k) && !rows.some((r) => r.builtin_key === k));
  if (!missing.length) return;
  const userId = await requireUserId();
  const { error } = await supabase.from("custom_categories").upsert(
    missing.map((k) => {
      const { label, icon, color } = DEFAULT_CATEGORIES.find((c) => c.id === k)!;
      return { label, icon, color, user_id: userId, builtin_key: k };
    }),
    { onConflict: "user_id,builtin_key", ignoreDuplicates: true },
  );
  if (error) throw error;
}

/** Saves the user's category order: `orderedIds[i]` gets position i. */
export async function saveCategoryOrder(orderedIds: string[], rows: CustomCategory[]) {
  await ensureBuiltinRows(orderedIds, rows);
  const userId = await requireUserId();
  const builtins = orderedIds.flatMap((id, i) => (isBuiltinKey(id) ? [{ id, i }] : []));
  const customs = orderedIds.flatMap((id, i) => (isBuiltinKey(id) ? [] : [{ id, i }]));
  // Two batched upserts (one per conflict key) instead of one request per row.
  const results = await Promise.all([
    builtins.length &&
      supabase.from("custom_categories").upsert(
        builtins.map(({ id, i }) => {
          const r = rows.find((row) => row.builtin_key === id);
          const d = DEFAULT_CATEGORIES.find((c) => c.id === id)!;
          return { user_id: userId, builtin_key: id, label: r?.label ?? d.label, icon: r?.icon ?? d.icon, color: r?.color ?? d.color, sort_order: i };
        }),
        { onConflict: "user_id,builtin_key" },
      ),
    customs.length &&
      supabase.from("custom_categories").upsert(
        customs.flatMap(({ id, i }) => {
          const r = rows.find((row) => row.id === id && !row.builtin_key);
          return r ? [{ id: r.id, user_id: userId, label: r.label, icon: r.icon, color: r.color, sort_order: i }] : [];
        }),
        { onConflict: "id" },
      ),
  ]);
  for (const res of results) if (res && res.error) throw res.error;
}

/**
 * Deletes a category, first moving its expenses to `moveTo` (required when it
 * has any). Default categories are hidden instead, so they can be restored.
 * Returns how many expenses were moved.
 */
export async function deleteCategory(id: string, moveTo: string | null, rows: CustomCategory[]) {
  await ensureBuiltinRows([id], rows);
  const { data, error } = await supabase.rpc("delete_category", { p_category: id, p_move_to: moveTo });
  if (error) throw error;
  return data ?? 0;
}

/** Shows a hidden default category again. */
export async function restoreCategory(id: string) {
  const { error } = await supabase.from("custom_categories").update({ hidden_at: null }).eq("builtin_key", id);
  if (error) throw error;
}

export async function countExpensesInCategory(id: string) {
  const { count, error } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("category", id);
  if (error) throw error;
  return count ?? 0;
}

export async function uploadExpenseImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const ext = file.name.split(".").pop();
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("expense-images")
    .upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage
    .from("expense-images")
    .getPublicUrl(path);
  return data.publicUrl;
}
