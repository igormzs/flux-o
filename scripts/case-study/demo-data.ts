/**
 * Deterministic demo dataset used for the v1 → v2 case-study screenshots.
 *
 * Every capture (v1 baseline and each v2 phase) is rendered against exactly
 * this data with the clock frozen at DEMO_NOW, so screenshots can be paired
 * one-to-one. The data deliberately includes the situations the v2 work fixes:
 *   - custom categories that reuse default colors (hard to tell apart in v1)
 *   - an expense on the cycle start day (25th), counted twice by v1 Insights
 *   - an expense in a second currency, summed as if it were USD in v1
 */

export const DEMO_NOW = "2026-09-20T10:00:00.000Z";

export const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "demo@flux-o.app",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

/** v1 kept settings in localStorage under this key. */
export const DEMO_LOCAL_SETTINGS = {
  budgetGoal: 2000,
  currency: "USD",
  notifications: { overBudget: true, weeklyReport: false, dailyReminder: false },
  periodType: "billing_cycle",
  billingCycleStartDay: 25,
};

type Row = Record<string, unknown>;

// Small seeded PRNG so the dataset is identical on every run.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(y: number, m: number, d: number, h = 12, min = 0) {
  return new Date(Date.UTC(y, m - 1, d, h, min)).toISOString();
}

export function buildDemoData(): Record<string, Row[]> {
  const rand = mulberry32(2026);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const money = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100) / 100;

  const created = "2026-01-02T09:00:00.000Z";
  const customCategories: Row[] = [
    // Same color as "Food" and "Subs": the v1 palette can't tell them apart.
    { id: "c0ffee00-0000-4000-8000-000000000001", user_id: DEMO_USER.id, label: "Coffee", icon: "Coffee", color: "mint", created_at: created },
    { id: "c0ffee00-0000-4000-8000-000000000002", user_id: DEMO_USER.id, label: "Gym", icon: "Barbell", color: "electric", created_at: "2026-01-03T09:00:00.000Z" },
  ];
  const [coffee, gym] = customCategories.map((c) => c.id as string);

  const expenses: Row[] = [];
  let n = 0;
  const add = (date: string, title: string, amount: number, category: string, note = "", currency = "USD") => {
    n += 1;
    expenses.push({
      id: `e0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      user_id: DEMO_USER.id,
      title,
      amount,
      category,
      custom_category_id: null,
      // v1 stores the currency inside the note as a "[XXX] " prefix.
      note: `[${currency}] ${note}`.trimEnd(),
      image_url: null,
      date,
      created_at: date,
      updated_at: date,
    });
  };

  // Jun 1 → Sep 20 2026 (DEMO_NOW)
  const start = Date.UTC(2026, 5, 1);
  const end = Date.UTC(2026, 8, 20);
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t);
    const [y, m, day, dow] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCDay()];

    if (day === 1) add(iso(y, m, day, 9), "Rent", 1200, "rent");
    if (day === 3) add(iso(y, m, day, 18), "Electricity & water", money(55, 80), "utilities");
    if (day === 5) add(iso(y, m, day, 8), "Netflix", 15.49, "subscriptions");
    if (day === 7) add(iso(y, m, day, 8), "Spotify", 10.99, "subscriptions");
    if (day === 10) add(iso(y, m, day, 7), "Gym membership", 39.9, gym);
    if (dow === 6 || (dow === 2 && rand() < 0.5)) add(iso(y, m, day, 11), pick(["Weekly groceries", "Supermarket", "Farmers market"]), money(35, 95), "grocery");
    if (dow >= 1 && dow <= 5 && rand() < 0.55) add(iso(y, m, day, 8, 30), pick(["Flat white", "Espresso", "Iced latte"]), money(2.5, 5.5), coffee);
    if (rand() < 0.35) add(iso(y, m, day, 13), pick(["Lunch", "Sushi", "Burger place", "Pizza night", "Poke bowl"]), money(9, 32), "food");
    if ((dow === 5 || dow === 6) && rand() < 0.6) add(iso(y, m, day, 22), pick(["Drinks with friends", "Bar", "Concert beers"]), money(18, 60), "nightlife");
    if (day === 18 && rand() < 0.7) add(iso(y, m, day, 16), pick(["Haircut", "Pharmacy", "Skincare"]), money(15, 45), "selfcare");
  }

  // Cycle-boundary case: exactly on the 25th (v1 Insights counts this in two cycles).
  add(iso(2026, 8, 25, 10), "Payday brunch", 48.6, "food", "Celebrating payday");
  // Second currency: v1 adds this to USD totals as-is.
  add(iso(2026, 9, 12, 15), "Train to Porto", 64, "travel", "Weekend trip", "EUR");
  add(iso(2026, 7, 14, 9), "Flights to Lisbon", 389, "travel", "Summer holiday");

  expenses.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const profiles: Row[] = [
    {
      id: DEMO_USER.id,
      username: "alex",
      first_name: "Alex",
      last_name: "Rivera",
      avatar_url: null,
      created_at: created,
      updated_at: created,
    },
  ];

  return { expenses, custom_categories: customCategories, profiles };
}

/**
 * Applies the v2 migrations to the demo data, mirroring the SQL in
 * supabase/migrations/ so v2 screenshots see the data exactly as the real
 * database would after migrating. Each phase adds its step here.
 */
export function applyV2Migrations(data: Record<string, Row[]>): Record<string, Row[]> {
  // 20260928120000_settings_on_profiles.sql: new columns get their defaults.
  for (const p of data.profiles) {
    Object.assign(p, {
      currency: "USD",
      budget_goal: 2000,
      billing_cycle_day: 25,
      default_scope: "cycle",
      week_starts_on: 1,
      notifications: { overBudget: true, weeklyReport: false, dailyReminder: false },
      settings_migrated_at: null,
    });
  }
  // 20260929120000_categories_2.sql: new category columns start empty.
  for (const c of data.custom_categories) Object.assign(c, { builtin_key: null, sort_order: null, hidden_at: null });
  // 20260928120100_expense_currency_column.sql: move "[XXX] " into a column.
  for (const e of data.expenses) {
    const m = String(e.note ?? "").match(/^\[([A-Z]{3})\]\s?(.*)$/);
    e.currency = m ? m[1] : null;
    if (m) e.note = m[2] || null;
  }
  return data;
}
