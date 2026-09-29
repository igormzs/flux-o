import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from "date-fns";

/**
 * All date ranges in Flux-o are half-open: `start` is included and `end` is
 * excluded ([start, end)). Consecutive periods share a boundary without
 * overlapping, so an expense always belongs to exactly one period.
 *
 * (v1 used inclusive end dates in some places and not in others, and counted
 * expenses on the cycle day in two cycles; see docs/case-study.)
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/** The ways a period of spending can be scoped. */
export type Scope = "cycle" | "month" | "week" | "year" | "last30" | "custom" | "all";

/**
 * When payday doesn't land on the cycle day (Phase 1b: "my cycle is 25th to
 * 25th, but payday moves").
 */
export interface PaydayOptions {
  /** A cycle day on a weekend moves to the Friday before, the Monday after, or stays. */
  weekendRule?: "none" | "before" | "after";
  /**
   * One-off moves: the start date of a specific cycle, keyed by the month its
   * usual start falls in ("2026-09" → "2026-09-23" for a Sep 25 payday paid on the 23rd).
   */
  overrides?: Record<string, string>;
}

export interface ScopeOptions {
  /** Day of the month a billing/salary cycle starts (1–31). */
  cycleDay: number;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** Required for the "custom" scope. */
  custom?: DateRange;
  payday?: PaydayOptions;
}

/** A one-off cycle start may move at most this many days from the usual one. */
export const MAX_PAYDAY_SHIFT_DAYS = 10;

export const DEFAULT_CYCLE_DAY = 25;
export const DEFAULT_WEEK_STARTS_ON = 1;

/** Beginning of time for the "all" scope; far enough back for any real data. */
const ALL_START = new Date(2000, 0, 1);
const ALL_END = new Date(2100, 0, 1);

/**
 * The usual cycle start inside a given month. A cycle day past the end of the
 * month snaps to the last day, so cycle day 31 starts on 28/29 Feb and 30 Apr.
 */
export function nominalCycleStart(year: number, month: number, cycleDay: number): Date {
  const days = getDaysInMonth(new Date(year, month, 1));
  return new Date(year, month, Math.min(Math.max(cycleDay, 1), days));
}

/** Key of the cycle whose usual start falls in this month, e.g. "2026-09". */
export const cycleKey = (nominalStart: Date) => format(nominalStart, "yyyy-MM");

/**
 * When the cycle "of" a month actually starts: a one-off override if the user
 * set one, else the usual day moved off a weekend by the weekend rule.
 */
export function cycleStart(year: number, month: number, cycleDay: number, payday?: PaydayOptions): Date {
  const nominal = nominalCycleStart(year, month, cycleDay);
  const override = payday?.overrides?.[cycleKey(nominal)];
  if (override) {
    const [y, m, d] = override.split("-").map(Number);
    const moved = new Date(y, m - 1, d);
    // Ignore anything that would reorder cycles (validated on save, too).
    if (Math.abs(differenceInCalendarDays(moved, nominal)) <= MAX_PAYDAY_SHIFT_DAYS) return moved;
  }
  const dow = nominal.getDay(); // 0 = Sun, 6 = Sat
  if (payday?.weekendRule === "before" && (dow === 0 || dow === 6)) return subDays(nominal, dow === 6 ? 1 : 2);
  if (payday?.weekendRule === "after" && (dow === 0 || dow === 6)) return addDays(nominal, dow === 6 ? 2 : 1);
  return nominal;
}

/** The billing cycle that contains `anchor`. */
export function getCycleRange(anchor: Date, cycleDay: number, payday?: PaydayOptions): DateRange {
  // With moved paydays a month's cycle can start in the month before or after,
  // so step from the anchor's month until [start, next start) contains it.
  let y = anchor.getFullYear();
  let m = anchor.getMonth();
  for (let guard = 0; guard < 4; guard++) {
    const start = cycleStart(y, m, cycleDay, payday);
    const end = cycleStart(y, m + 1, cycleDay, payday);
    if (anchor < start) m -= 1;
    else if (anchor >= end) m += 1;
    else return { start, end };
    if (m < 0) { m += 12; y -= 1; }
    if (m > 11) { m -= 12; y += 1; }
  }
  throw new Error("cycle not found");
}

/** The usual (unmoved) start of the cycle that begins at `range.start`. */
export function nominalStartOfCycle(range: DateRange, cycleDay: number): Date {
  // A moved start is within MAX_PAYDAY_SHIFT_DAYS of the usual one, so the
  // usual start is the nominal day of this month or a neighbouring one.
  const s = range.start;
  const candidates = [-1, 0, 1].map((dm) => nominalCycleStart(s.getFullYear(), s.getMonth() + dm, cycleDay));
  return candidates.reduce((best, c) =>
    Math.abs(differenceInCalendarDays(c, s)) < Math.abs(differenceInCalendarDays(best, s)) ? c : best,
  );
}

/** The period of the given scope that contains `anchor`. */
export function getScopeRange(scope: Scope, anchor: Date, opts: ScopeOptions): DateRange {
  const weekStartsOn = opts.weekStartsOn ?? DEFAULT_WEEK_STARTS_ON;
  switch (scope) {
    case "cycle":
      return getCycleRange(anchor, opts.cycleDay, opts.payday);
    case "month": {
      const start = startOfMonth(anchor);
      return { start, end: addMonths(start, 1) };
    }
    case "week": {
      const start = startOfWeek(anchor, { weekStartsOn });
      return { start, end: addDays(start, 7) };
    }
    case "year": {
      const start = startOfYear(anchor);
      return { start, end: addYears(start, 1) };
    }
    case "last30": {
      const end = addDays(startOfDay(anchor), 1);
      return { start: subDays(end, 30), end };
    }
    case "custom":
      if (!opts.custom) throw new Error("custom scope needs a range");
      return opts.custom;
    case "all":
      return { start: ALL_START, end: ALL_END };
  }
}

/**
 * The period of the same kind that comes right before `range`: last cycle,
 * last month, last week, or (for last30/custom) the same number of days
 * immediately before. Returns null for "all".
 */
export function getPreviousRange(range: DateRange, scope: Scope, opts: ScopeOptions): DateRange | null {
  const justBefore = new Date(range.start.getTime() - 1);
  switch (scope) {
    case "cycle":
    case "month":
    case "week":
    case "year":
      return getScopeRange(scope, justBefore, opts);
    case "last30":
    case "custom": {
      const days = differenceInCalendarDays(range.end, range.start);
      return { start: subDays(range.start, days), end: range.start };
    }
    case "all":
      return null;
  }
}

/** The `count` periods of the same kind ending with `range`, oldest first. */
export function getRecentRanges(range: DateRange, scope: Scope, opts: ScopeOptions, count: number): DateRange[] {
  const out = [range];
  while (out.length < count) {
    const prev = getPreviousRange(out[0], scope, opts);
    if (!prev) break;
    out.unshift(prev);
  }
  return out;
}

/**
 * The first part of `range`, as long as the part of `current` that has
 * already happened by `now`. Used to compare a period in progress with the
 * same point of earlier ones ("€900 by day 12" vs "€1,050 by day 12").
 * Returns `range` unchanged when `current` is already over.
 */
export function samePointIn(range: DateRange, current: DateRange, now: Date): DateRange {
  if (now >= current.end || now < current.start) return range;
  const elapsed = now.getTime() - current.start.getTime();
  const end = new Date(Math.min(range.start.getTime() + elapsed, range.end.getTime()));
  return { start: range.start, end };
}

/** Custom range from inclusive calendar days (as picked in a date picker). */
export function rangeFromDays(from: Date, to: Date): DateRange {
  return { start: startOfDay(from), end: addDays(startOfDay(to), 1) };
}

/** The last day included in a half-open range, for display ("Aug 25 – Sep 24"). */
export function lastDayOf(range: DateRange): Date {
  return subDays(range.end, 1);
}

export function isInRange(date: Date | string, range: DateRange): boolean {
  const t = new Date(date).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

/**
 * Week N (0-based) of a cycle: cycle start + 7N days, clipped to the cycle end.
 * The last week of a cycle can be shorter than 7 days.
 */
export function getCycleWeek(cycle: DateRange, index: number): DateRange {
  const start = addDays(cycle.start, index * 7);
  const end = addDays(start, 7);
  return { start, end: end > cycle.end ? cycle.end : end };
}

/** Index of the cycle week that contains `date`. */
export function getCycleWeekIndex(cycle: DateRange, date: Date): number {
  return Math.floor(Math.max(0, differenceInCalendarDays(date, cycle.start)) / 7);
}

/** Number of (possibly partial) weeks in a range. */
export function countWeeks(range: DateRange): number {
  return Math.max(1, Math.ceil(differenceInCalendarDays(range.end, range.start) / 7));
}
