export interface Expense {
  id: string;
  amount: number;
  category: string;
  note?: string;
  date: string; // ISO string
}

export const CATEGORIES = [
  { id: "food", label: "Food", emoji: "🍕", color: "mint" },
  { id: "grocery", label: "Grocery", emoji: "🛒", color: "teal" },
  { id: "rent", label: "Rent", emoji: "🏠", color: "lavender" },
  { id: "subscriptions", label: "Subs", emoji: "📺", color: "electric" },
  { id: "nightlife", label: "Nightlife", emoji: "🍻", color: "pink" },
  { id: "utilities", label: "Utilities", emoji: "🔌", color: "yellow" },
  { id: "selfcare", label: "Self-care", emoji: "🎁", color: "peach" },
  { id: "travel", label: "Travel", emoji: "✈️", color: "coral" },
] as const;

export type CategoryId = typeof CATEGORIES[number]["id"];

const STORAGE_KEY = "fluxo_expenses";

export function getExpenses(): Expense[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveExpense(expense: Omit<Expense, "id">): Expense {
  const expenses = getExpenses();
  const newExpense = { ...expense, id: crypto.randomUUID() };
  expenses.unshift(newExpense);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  return newExpense;
}

export function deleteExpense(id: string) {
  const expenses = getExpenses().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

export function getCategoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}
