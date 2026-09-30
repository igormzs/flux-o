/**
 * The Monday weekly report: when to send it (in each user's time zone), which
 * week it covers, and what it says. No I/O, so it's unit-tested with the app.
 */

/** Local hour on Monday when the report goes out. */
export const REPORT_HOUR = 9;

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", BRL: "R$", JPY: "¥", CAD: "CA$" };

/** Same format as the app ("€1,234.50"). */
export function formatMoney(amount: number, currency: string): string {
  return (SYMBOLS[currency] ?? `${currency} `) + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Default category labels (kept in step with DEFAULT_CATEGORIES in src/lib/categories.ts). */
export const DEFAULT_LABELS: Record<string, string> = {
  food: "Food", grocery: "Grocery", rent: "Rent", subscriptions: "Subs",
  nightlife: "Drinks", utilities: "Utilities", selfcare: "Self-care", travel: "Travel",
};

interface LocalParts { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

/** The wall-clock date and time in `timeZone`. weekday: 1 = Monday … 7 = Sunday. */
export function localParts(at: Date, timeZone: string): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" })
      .formatToParts(at).map((p) => [p.type, p.value]),
  );
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday) + 1;
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, weekday };
}

/** The instant of local midnight at the start of year-month-day in `timeZone`. */
export function localMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const wall = Date.UTC(year, month - 1, day);
  let guess = wall;
  // Two passes settle the offset, including across a daylight saving change.
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), timeZone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess = wall - (shown - guess);
  }
  return new Date(guess);
}

/** A valid IANA time zone, or UTC. */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export interface ReportWeek {
  /** Monday 00:00 of the week reported (inclusive). */
  start: Date;
  /** The Monday after (exclusive): the week the report is sent in. */
  end: Date;
  /** Monday 00:00 of the week before, for the comparison. */
  prevStart: Date;
  /** "2026-09-28": the reported week's Monday, used so a report is sent once. */
  key: string;
}

/** The finished Monday–Sunday week before the one `at` falls in. */
export function reportWeek(at: Date, timeZone: string): ReportWeek {
  const p = localParts(at, timeZone);
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - (p.weekday - 1)));
  const day = (offset: number) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + offset);
    return d;
  };
  const at0 = (d: Date) => localMidnight(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), timeZone);
  const start = day(-7);
  return { start: at0(start), end: at0(monday), prevStart: at0(day(-14)), key: start.toISOString().slice(0, 10) };
}

/** Monday, from REPORT_HOUR on (a missed hourly run is caught up later the same day). */
export function isReportDue(at: Date, timeZone: string): boolean {
  const p = localParts(at, timeZone);
  return p.weekday === 1 && p.hour >= REPORT_HOUR;
}

export interface WeekTotals {
  total: number;
  prevTotal: number;
  count: number;
  top: { label: string; amount: number } | null;
}

interface ExpenseRow { amount: number | string; category: string; currency: string | null; date: string }
interface CategoryRow { id: string; label: string; builtin_key?: string | null }

export function categoryLabel(id: string, custom: CategoryRow[]): string {
  const own = custom.find((c) => c.id === id || c.builtin_key === id);
  return own?.label ?? DEFAULT_LABELS[id] ?? "Other";
}

/** Totals in the main currency for the reported week and the one before. */
export function weekTotals(expenses: ExpenseRow[], week: ReportWeek, currency: string, custom: CategoryRow[]): WeekTotals {
  let total = 0, prevTotal = 0, count = 0;
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    if ((e.currency ?? currency) !== currency) continue;
    const t = new Date(e.date).getTime();
    const amount = Number(e.amount);
    if (t >= week.start.getTime() && t < week.end.getTime()) {
      total += amount;
      count++;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount);
    } else if (t >= week.prevStart.getTime() && t < week.start.getTime()) {
      prevTotal += amount;
    }
  }
  const [topId, topAmount] = [...byCategory].sort((a, b) => b[1] - a[1])[0] ?? [];
  return { total, prevTotal, count, top: topId ? { label: categoryLabel(topId, custom), amount: topAmount } : null };
}

/** The notification text. */
export function weeklyMessage(t: WeekTotals, currency: string): { title: string; body: string } {
  if (t.count === 0) {
    return { title: "Your week: nothing logged", body: "No expenses last week. Anything to catch up on? Add several at once from the + button." };
  }
  const parts: string[] = [];
  if (t.prevTotal > 0) {
    const pct = Math.round(((t.total - t.prevTotal) / t.prevTotal) * 100);
    parts.push(pct === 0 ? "Same as the week before" : `${Math.abs(pct)}% ${pct < 0 ? "less" : "more"} than the week before`);
  } else {
    parts.push("Nothing the week before");
  }
  if (t.top) parts.push(`Top: ${t.top.label} ${formatMoney(t.top.amount, currency)}`);
  return { title: `Your week: ${formatMoney(t.total, currency)}`, body: parts.join(" · ") };
}
