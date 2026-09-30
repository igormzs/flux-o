/**
 * The budget alert: is the user over their goal for the current pay cycle, or
 * about to be once recurring expenses still to come are counted?
 *
 * The pay cycle and "still to come" are worked out here with plain calendar
 * days ("yyyy-MM-dd"), so the result doesn't depend on the server's time
 * zone. They mirror getCycleRange (src/lib/date-utils.ts) and stillToCome
 * (src/lib/recurring.ts); unit tests compare the two day by day.
 */
import { formatMoney } from "./weekly.ts";

/** Alerts go out between these local hours, so a late expense doesn't buzz at night. */
export const ALERT_FROM_HOUR = 9;
export const ALERT_UNTIL_HOUR = 21;

const MAX_PAYDAY_SHIFT_DAYS = 10;
const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");
/** Days since 1970 for a calendar day; month may overflow (13 = January next year). */
const dayNumber = (y: number, m1: number, d: number) => Date.UTC(y, m1 - 1, d) / DAY;
const parse = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return dayNumber(y, m, d); };
const toYmd = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const daysInMonth = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0)).getUTCDate();

export interface PaydayRules {
  cycleDay: number;
  weekendRule?: string | null;
  /** One-off starts: { "yyyy-MM" (the cycle's usual month): "yyyy-MM-dd" }. */
  overrides?: Record<string, string> | null;
}

/** When the cycle "of" a month starts, as a day number. */
function cycleStart(y: number, m1: number, rules: PaydayRules): number {
  const first = new Date(Date.UTC(y, m1 - 1, 1)); // normalises month overflow
  const yy = first.getUTCFullYear();
  const mm = first.getUTCMonth() + 1;
  const nominal = dayNumber(yy, mm, Math.min(Math.max(rules.cycleDay, 1), daysInMonth(yy, mm)));
  const override = rules.overrides?.[`${yy}-${pad(mm)}`];
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    const moved = parse(override);
    if (Math.abs(moved - nominal) <= MAX_PAYDAY_SHIFT_DAYS) return moved;
  }
  const dow = new Date(nominal * DAY).getUTCDay(); // 0 = Sun, 6 = Sat
  if (rules.weekendRule === "before" && (dow === 0 || dow === 6)) return nominal - (dow === 6 ? 1 : 2);
  if (rules.weekendRule === "after" && (dow === 0 || dow === 6)) return nominal + (dow === 6 ? 2 : 1);
  return nominal;
}

/** The pay cycle containing `today`: start (inclusive) and end (exclusive), as calendar days. */
export function cycleRange(today: string, rules: PaydayRules): { start: string; end: string } {
  const t = parse(today);
  let [y, m] = today.split("-").map(Number);
  for (let guard = 0; guard < 4; guard++) {
    const start = cycleStart(y, m, rules);
    const end = cycleStart(y, m + 1, rules);
    if (t < start) m -= 1;
    else if (t >= end) m += 1;
    else return { start: toYmd(start), end: toYmd(end) };
    if (m < 1) { m += 12; y -= 1; }
    if (m > 12) { m -= 12; y += 1; }
  }
  throw new Error("cycle not found");
}

interface Bill {
  id: string;
  amount: number | string;
  currency: string | null;
  day_of_month: number;
  active: boolean;
  starts_on: string;
  skipped: string[] | null;
}
interface Confirmed { recurring_id: string; recurring_period: string; amount: number | string }

/**
 * Recurring expenses not confirmed yet that fall inside the cycle, in the main
 * currency, each at the amount paid last time (or its usual amount).
 */
export function recurringToCome(bills: Bill[], confirmed: Confirmed[], range: { start: string; end: string }, mainCurrency: string): number {
  let total = 0;
  for (const bill of bills) {
    if (!bill.active || (bill.currency ?? mainCurrency) !== mainCurrency) continue;
    const own = confirmed.filter((c) => c.recurring_id === bill.id);
    const last = [...own].sort((a, b) => b.recurring_period.localeCompare(a.recurring_period))[0];
    const amount = Number(last ? last.amount : bill.amount);
    // Every month the cycle touches.
    let [y, m] = range.start.split("-").map(Number);
    const [endY, endM] = range.end.split("-").map(Number);
    while (y < endY || (y === endY && m <= endM)) {
      const period = `${y}-${pad(m)}`;
      const due = `${period}-${pad(Math.min(Math.max(bill.day_of_month, 1), daysInMonth(y, m)))}`;
      const open = !own.some((c) => c.recurring_period === period) && !(bill.skipped ?? []).includes(period);
      if (open && due >= bill.starts_on && due >= range.start && due < range.end) total += amount;
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
  }
  return total;
}

export interface BudgetAlert {
  stage: "over" | "forecast";
  /** "2026-09-25:over": the cycle and the stage, so each alert is sent once per cycle. */
  key: string;
  title: string;
  body: string;
  url: string;
}

/**
 * The alert for the current state, or null. "over": spending has passed the
 * goal. "forecast": it hasn't yet, but will once the recurring expenses still
 * to come this cycle are paid.
 */
export function budgetAlert(input: { goal: number; spent: number; toCome: number; cycleStart: string; currency: string }): BudgetAlert | null {
  const { goal, spent, toCome, cycleStart: start, currency } = input;
  if (!(goal > 0)) return null;
  const money = (n: number) => formatMoney(n, currency);
  if (spent > goal) {
    return {
      stage: "over",
      key: `${start}:over`,
      title: `Over budget by ${money(spent - goal)}`,
      body: `${money(spent)} spent of your ${money(goal)} goal this cycle.${toCome > 0 ? ` ${money(toCome)} in recurring expenses still to come.` : ""}`,
      url: "/",
    };
  }
  if (toCome > 0 && spent + toCome > goal) {
    return {
      stage: "forecast",
      key: `${start}:forecast`,
      title: "On track to go over budget",
      body: `${money(spent)} spent and ${money(toCome)} in recurring expenses still to come: ${money(spent + toCome - goal)} over your ${money(goal)} goal.`,
      url: "/",
    };
  }
  return null;
}

/** Whether alerts may be sent at this local hour. */
export const isAlertHour = (hour: number) => hour >= ALERT_FROM_HOUR && hour < ALERT_UNTIL_HOUR;
