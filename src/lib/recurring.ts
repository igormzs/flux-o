import { addMonths, format, getDaysInMonth, startOfMonth } from "date-fns";
import type { DateRange } from "./date-utils";
import type { ExpenseInput } from "./expenses";

/**
 * Recurring expenses: bills the user expects every month (rent, utilities,
 * subscriptions). The app never adds them by itself. It works out which are
 * due, suggests the amount paid last time, and the user confirms each with the
 * real amount. Everything here is pure; the data access is in lib/expenses.ts.
 */

/** A row of `recurring_expenses`. */
export interface RecurringExpense {
  id: string;
  user_id: string;
  title: string;
  /** The usual amount, used until there's a confirmed one to go by. */
  amount: number;
  /** ISO code; null means the user's main currency. */
  currency: string | null;
  category: string;
  /** 1–31; months with fewer days use their last day. */
  day_of_month: number;
  /** Paused bills are kept but never due. */
  active: boolean;
  /** "yyyy-MM-dd": occurrences before this day don't count. */
  starts_on: string;
  /** Months the user skipped, as "yyyy-MM". */
  skipped: string[];
  created_at: string;
}

export interface RecurringInput {
  title: string;
  amount: number;
  currency: string | null;
  category: string;
  day_of_month: number;
  active: boolean;
}

/** An expense that confirmed a bill for one month. */
export interface Confirmation {
  id: string;
  recurring_id: string;
  recurring_period: string;
  amount: number;
  date: string;
}

export type OccurrenceStatus = "due" | "upcoming" | "confirmed" | "skipped";

/** One bill in one month. */
export interface Occurrence {
  bill: RecurringExpense;
  /** "yyyy-MM" */
  period: string;
  /** "yyyy-MM-dd" */
  dueDate: string;
  status: OccurrenceStatus;
  /** What was paid last time, or the usual amount. */
  suggestedAmount: number;
  confirmation?: Confirmation;
}

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");
export const periodKey = (d: Date) => format(d, "yyyy-MM");

/** The day a bill falls on in a month ("31" becomes the 30th, or 28 Feb). */
export function dueDateIn(month: Date, dayOfMonth: number): string {
  const first = startOfMonth(month);
  const day = Math.min(Math.max(1, dayOfMonth), getDaysInMonth(first));
  return dayKey(new Date(first.getFullYear(), first.getMonth(), day));
}

/** The amount to pre-fill: the most recent confirmed one, else the usual amount. */
export function suggestedAmount(bill: RecurringExpense, confirmations: Confirmation[]): number {
  const last = confirmations
    .filter((c) => c.recurring_id === bill.id)
    .sort((a, b) => b.recurring_period.localeCompare(a.recurring_period))[0];
  return last ? Number(last.amount) : Number(bill.amount);
}

/**
 * Every active bill in last month, this month and next month, with its
 * status. Last month is included so a bill missed at the end of a month is
 * still asked for; older ones are dropped, not piled up.
 */
export function occurrences(bills: RecurringExpense[], confirmations: Confirmation[], today: Date): Occurrence[] {
  const todayKey = dayKey(today);
  const months = [-1, 0, 1].map((n) => addMonths(startOfMonth(today), n));
  const out: Occurrence[] = [];
  for (const bill of bills) {
    if (!bill.active) continue;
    const suggested = suggestedAmount(bill, confirmations);
    for (const month of months) {
      const period = periodKey(month);
      const dueDate = dueDateIn(month, bill.day_of_month);
      if (dueDate < bill.starts_on) continue;
      const confirmation = confirmations.find((c) => c.recurring_id === bill.id && c.recurring_period === period);
      const status: OccurrenceStatus = confirmation
        ? "confirmed"
        : (bill.skipped ?? []).includes(period)
          ? "skipped"
          : dueDate <= todayKey ? "due" : "upcoming";
      out.push({ bill, period, dueDate, status, suggestedAmount: suggested, confirmation });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.bill.title.localeCompare(b.bill.title));
}

/** Bills whose day has come and that aren't confirmed or skipped. */
export const dueOccurrences = (all: Occurrence[]) => all.filter((o) => o.status === "due");

/**
 * What the Recurring expenses screen shows for a bill: anything overdue from
 * last month, then this month's occurrence.
 */
export function currentOccurrences(all: Occurrence[], bill: RecurringExpense, today: Date): Occurrence[] {
  const thisMonth = periodKey(today);
  return all.filter((o) => o.bill.id === bill.id && (o.period === thisMonth || (o.period < thisMonth && o.status === "due")));
}

/**
 * Bills not paid yet that fall inside `range` (the current pay cycle), in the
 * main currency: due ones still to confirm plus upcoming ones.
 */
export function stillToCome(all: Occurrence[], range: DateRange, mainCurrency: string): { total: number; count: number } {
  const start = dayKey(range.start);
  const end = dayKey(range.end);
  const open = all.filter((o) =>
    (o.status === "due" || o.status === "upcoming")
    && o.dueDate >= start && o.dueDate < end
    && (o.bill.currency ?? mainCurrency) === mainCurrency);
  return { total: open.reduce((sum, o) => sum + o.suggestedAmount, 0), count: open.length };
}

/** The usual monthly total of active bills in the main currency. */
export function monthlyTotal(bills: RecurringExpense[], mainCurrency: string): number {
  return bills.filter((b) => b.active && (b.currency ?? mainCurrency) === mainCurrency).reduce((sum, b) => sum + Number(b.amount), 0);
}

/**
 * The expense that confirms an occurrence. Dated on the due day (or today, if
 * confirmed early), at noon so no time zone can move it to another day.
 */
export function confirmationExpense(o: Occurrence, amount: number, today: Date): ExpenseInput {
  const day = o.dueDate <= dayKey(today) ? o.dueDate : dayKey(today);
  return {
    title: o.bill.title,
    amount,
    category: o.bill.category,
    currency: o.bill.currency,
    date: new Date(`${day}T12:00:00`).toISOString(),
    recurring_id: o.bill.id,
    recurring_period: o.period,
  };
}

/** What's missing before a bill can be saved. */
export function recurringErrors(input: { title: string; amount: string; category: string; day: string }): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Add a name");
  const amount = Number(input.amount.replace(",", "."));
  if (!input.amount.trim() || !Number.isFinite(amount) || amount < 0) errors.push("Add the usual amount");
  const day = Number(input.day);
  if (!Number.isInteger(day) || day < 1 || day > 31) errors.push("Pick a day from 1 to 31");
  if (!input.category) errors.push("Pick a category");
  return errors;
}

/** "5th", "1st", "22nd". */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** A key for one occurrence in lists and form state. */
export const occurrenceKey = (o: Occurrence) => `${o.bill.id}:${o.period}`;

/** The amount typed when confirming ("31,20" or "31.20"), or null if it isn't one. */
export function parseBillAmount(value: string): number | null {
  const n = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}
