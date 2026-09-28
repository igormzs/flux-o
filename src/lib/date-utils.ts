import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
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
export type Scope = "cycle" | "month" | "week" | "last30" | "custom" | "all";

export interface ScopeOptions {
  /** Day of the month a billing/salary cycle starts (1–31). */
  cycleDay: number;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** Required for the "custom" scope. */
  custom?: DateRange;
}

export const DEFAULT_CYCLE_DAY = 25;
export const DEFAULT_WEEK_STARTS_ON = 1;

/** Beginning of time for the "all" scope; far enough back for any real data. */
const ALL_START = new Date(2000, 0, 1);
const ALL_END = new Date(2100, 0, 1);

/**
 * The cycle start inside a given month. A cycle day past the end of the month
 * snaps to the last day, so cycle day 31 starts on 28/29 Feb and 30 Apr.
 */
function cycleStartInMonth(year: number, month: number, cycleDay: number): Date {
  const days = getDaysInMonth(new Date(year, month, 1));
  return new Date(year, month, Math.min(Math.max(cycleDay, 1), days));
}

/** The billing cycle that contains `anchor`. */
export function getCycleRange(anchor: Date, cycleDay: number): DateRange {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  let start = cycleStartInMonth(y, m, cycleDay);
  if (anchor < start) start = cycleStartInMonth(y, m - 1, cycleDay);
  const end = cycleStartInMonth(start.getFullYear(), start.getMonth() + 1, cycleDay);
  return { start, end };
}

/** The period of the given scope that contains `anchor`. */
export function getScopeRange(scope: Scope, anchor: Date, opts: ScopeOptions): DateRange {
  const weekStartsOn = opts.weekStartsOn ?? DEFAULT_WEEK_STARTS_ON;
  switch (scope) {
    case "cycle":
      return getCycleRange(anchor, opts.cycleDay);
    case "month": {
      const start = startOfMonth(anchor);
      return { start, end: addMonths(start, 1) };
    }
    case "week": {
      const start = startOfWeek(anchor, { weekStartsOn });
      return { start, end: addDays(start, 7) };
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
