import { supabase } from "@/integrations/supabase/client";

export interface Expense {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  category: string;
  custom_category_id: string | null;
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

export const DEFAULT_CATEGORIES = [
  { id: "food", label: "Food", icon: "Pizza", color: "mint" },
  { id: "grocery", label: "Grocery", icon: "ShoppingCart", color: "teal" },
  { id: "rent", label: "Rent", icon: "House", color: "lavender" },
  { id: "subscriptions", label: "Subs", icon: "Television", color: "electric" },
  { id: "nightlife", label: "Nightlife", icon: "BeerBottle", color: "pink" },
  { id: "utilities", label: "Utilities", icon: "Plug", color: "yellow" },
  { id: "selfcare", label: "Self-care", icon: "Gift", color: "peach" },
  { id: "travel", label: "Travel", icon: "AirplaneTilt", color: "coral" },
] as const;

export async function getExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data as Expense[];
}

export async function saveExpense(expense: {
  title: string;
  amount: number;
  category: string;
  custom_category_id?: string | null;
  note?: string;
  image_url?: string | null;
  date: string;
}) {
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

export function getCategoryInfo(categoryId: string, customCategories: CustomCategory[]) {
  const defaultCat = DEFAULT_CATEGORIES.find((c) => c.id === categoryId);
  if (defaultCat) return defaultCat;
  const custom = customCategories.find((c) => c.id === categoryId);
  if (custom) return { id: custom.id, label: custom.label, icon: custom.icon, color: custom.color };
  return { id: categoryId, label: categoryId, icon: "CurrencyDollar", color: "mint" };
}
