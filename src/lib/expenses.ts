import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "./date-utils";

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

export interface CustomCategory {
  id: string;
  user_id: string;
  label: string;
  icon: string;
  color: string;
  created_at: string;
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

export async function createCustomCategory(category: {
  label: string;
  icon: string;
  color: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("custom_categories")
    .insert({ ...category, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as CustomCategory;
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
