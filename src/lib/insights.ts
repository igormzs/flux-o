import { addDays, addMonths, format } from "date-fns";
import { countWeeks, getCycleWeek, isInRange, lastDayOf, samePointIn, type DateRange, type Scope } from "./date-utils";

/**
 * Pure helpers behind the Insights screen (Phase 1b): period labels and the
 * comparisons with earlier periods of the same kind. Amounts passed in here
 * are already in the main currency (see splitByCurrency).
 */

export type InsightScope = Extract<Scope, "cycle" | "month" | "week" | "year" | "custom">;
export const INSIGHT_SCOPES: { id: InsightScope; label: string }[] = [
  { id: "cycle", label: "Cycle" },
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

/** How many periods the comparison chart shows, the selected one included. */
export const HISTORY_LENGTH: Record<InsightScope, number> = { cycle: 6, month: 6, week: 8, year: 3, custom: 4 };

export const periodNoun = (scope: InsightScope) => (scope === "custom" ? "period" : scope);

interface Dated {
  date: string;
  amount: number | string;
  category: string;
}

/** Labels for a period: a short chip label and a full one for the header. */
export function periodLabel(range: DateRange, scope: InsightScope, now: Date) {
  const base = periodLabels(range, scope, now);
  // Chart axis: weeks and custom ranges are too long for 8 bars on a phone.
  return { ...base, tick: scope === "week" || scope === "custom" ? format(range.start, "M/d") : base.chip };
}

function periodLabels(range: DateRange, scope: InsightScope, now: Date) {
  const last = lastDayOf(range);
  const sameYear = (d: Date) => d.getFullYear() === now.getFullYear();
  const span = `${format(range.start, "MMM d")} – ${format(last, sameYear(last) && sameYear(range.start) ? "MMM d" : "MMM d, yyyy")}`;
  switch (scope) {
    case "cycle":
      // Named after the month it runs into, as in v1: Aug 25 – Sep 24 is the "September" cycle.
      return { chip: format(last, sameYear(last) ? "MMM" : "MMM ’yy"), title: `${format(last, "MMMM")} cycle`, span };
    case "month":
      return { chip: format(range.start, sameYear(range.start) ? "MMM" : "MMM ’yy"), title: format(range.start, "MMMM yyyy"), span };
    case "week":
      return { chip: format(range.start, "MMM d"), title: `Week of ${format(range.start, "MMM d")}`, span };
    case "year":
      return { chip: format(range.start, "yyyy"), title: format(range.start, "yyyy"), span };
    case "custom":
      return { chip: span, title: "Custom range", span };
  }
}

export const sumIn = (expenses: Dated[], range: DateRange) =>
  expenses.reduce((s, e) => (isInRange(e.date, range) ? s + Number(e.amount) : s), 0);

export type BaselineMode = "previous" | "average";

export interface Comparison {
  current: number;
  /** What `current` is compared with, or null when there's nothing to compare. */
  baseline: number | null;
  diff: number;
  pct: number | null;
  /** The current period isn't over, so earlier ones are cut at the same point. */
  partial: boolean;
  /** The (possibly cut) earlier periods the baseline averages. */
  baselineRanges: DateRange[];
}

/**
 * Compares the last of `ranges` (oldest first) with the one before it, or
 * with the average of up to 3 before it. While it's still running, earlier
 * periods are cut at the same point, so day 12 is compared with day 12 and
 * not with a whole finished period. Periods with no spending at all (e.g.
 * before the user started using Flux-o) are left out of the average.
 */
export function comparePeriods(expenses: Dated[], ranges: DateRange[], now: Date, mode: BaselineMode): Comparison {
  const current = ranges[ranges.length - 1];
  const earlier = ranges.slice(0, -1).slice(mode === "previous" ? -1 : -3);
  const partial = now >= current.start && now < current.end;
  const cut = earlier.map((r) => samePointIn(r, current, now));
  const withData = cut.filter((r) => sumIn(expenses, r) > 0);
  const currentTotal = sumIn(expenses, current);
  const baseline = withData.length ? withData.reduce((s, r) => s + sumIn(expenses, r), 0) / withData.length : null;
  const diff = baseline === null ? 0 : currentTotal - baseline;
  return {
    current: currentTotal,
    baseline,
    diff,
    pct: baseline ? Math.round((diff / baseline) * 100) : null,
    partial,
    baselineRanges: withData,
  };
}

/** Per category: total in `range` and the average over the comparison's baseline ranges. */
export function categoryComparison(expenses: Dated[], range: DateRange, baselineRanges: DateRange[]) {
  const ids = new Set(expenses.filter((e) => isInRange(e.date, range)).map((e) => e.category));
  return [...ids].map((id) => {
    const mine = expenses.filter((e) => e.category === id);
    const total = sumIn(mine, range);
    const baseline = baselineRanges.length
      ? baselineRanges.reduce((s, r) => s + sumIn(mine, r), 0) / baselineRanges.length
      : null;
    return { id, total, baseline, pct: baseline ? Math.round(((total - baseline) / baseline) * 100) : null };
  });
}

/** Totals for the comparison chart, with the average of the finished periods that had spending. */
export function history(expenses: Dated[], ranges: DateRange[], now: Date) {
  const bars = ranges.map((range, i) => ({
    range,
    total: sumIn(expenses, range),
    selected: i === ranges.length - 1,
    inProgress: now >= range.start && now < range.end,
  }));
  const finished = bars.filter((b) => !b.inProgress && b.range.end <= now && b.total > 0);
  const average = finished.length ? finished.reduce((s, b) => s + b.total, 0) / finished.length : null;
  return { bars, average };
}

/**
 * The slices "Spending over time" splits a period into: days for a week,
 * months for a year, and 7-day blocks from the period's start otherwise.
 */
export function timeBuckets(range: DateRange, scope: InsightScope): { range: DateRange; label: string }[] {
  if (scope === "week") {
    return Array.from({ length: 7 }, (_, i) => {
      const start = addDays(range.start, i);
      return { range: { start, end: addDays(start, 1) }, label: format(start, "EEE") };
    });
  }
  if (scope === "year") {
    return Array.from({ length: 12 }, (_, i) => {
      const start = addMonths(range.start, i);
      return { range: { start, end: addMonths(start, 1) }, label: format(start, "MMM") };
    });
  }
  return Array.from({ length: countWeeks(range) }, (_, i) => ({ range: getCycleWeek(range, i), label: `W${i + 1}` }));
}

export const BUCKET_NOUN: Record<InsightScope, string> = { week: "day", year: "month", cycle: "week", month: "week", custom: "week" };
