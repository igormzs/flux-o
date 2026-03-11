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

function generateSampleData(): Expense[] {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  const samples: Omit<Expense, "id">[] = [
    // This month
    { amount: 12.50, category: "food", date: new Date(y, m, 2).toISOString(), note: "Lunch" },
    { amount: 85.00, category: "grocery", date: new Date(y, m, 3).toISOString() },
    { amount: 1200, category: "rent", date: new Date(y, m, 1).toISOString() },
    { amount: 14.99, category: "subscriptions", date: new Date(y, m, 5).toISOString(), note: "Netflix" },
    { amount: 42.00, category: "nightlife", date: new Date(y, m, 7).toISOString() },
    { amount: 65.00, category: "utilities", date: new Date(y, m, 4).toISOString() },
    { amount: 28.00, category: "selfcare", date: new Date(y, m, 6).toISOString(), note: "Haircut" },
    { amount: 9.99, category: "food", date: new Date(y, m, 8).toISOString(), note: "Coffee" },
    { amount: 35.00, category: "grocery", date: new Date(y, m, 9).toISOString() },
    // Last month
    { amount: 15.00, category: "food", date: new Date(y, m - 1, 10).toISOString() },
    { amount: 90.00, category: "grocery", date: new Date(y, m - 1, 5).toISOString() },
    { amount: 1200, category: "rent", date: new Date(y, m - 1, 1).toISOString() },
    { amount: 25.00, category: "nightlife", date: new Date(y, m - 1, 15).toISOString() },
    { amount: 60.00, category: "utilities", date: new Date(y, m - 1, 3).toISOString() },
    // 2 months ago
    { amount: 1200, category: "rent", date: new Date(y, m - 2, 1).toISOString() },
    { amount: 70.00, category: "grocery", date: new Date(y, m - 2, 8).toISOString() },
    { amount: 55.00, category: "utilities", date: new Date(y, m - 2, 4).toISOString() },
    // 3 months ago
    { amount: 1200, category: "rent", date: new Date(y, m - 3, 1).toISOString() },
    { amount: 45.00, category: "grocery", date: new Date(y, m - 3, 12).toISOString() },
  ];
  return samples.map((s) => ({ ...s, id: crypto.randomUUID() })).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

const SEEDED_KEY = "fluxo_seeded";

export function getExpenses(): Expense[] {
  // Seed sample data on first visit
  if (!localStorage.getItem(SEEDED_KEY)) {
    const sample = generateSampleData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
    localStorage.setItem(SEEDED_KEY, "1");
    return sample;
  }
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
