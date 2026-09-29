import { describe, it, expect } from "vitest";
import { categoryComparison, comparePeriods, history, periodLabel } from "./insights";

const d = (y: number, m: number, day: number, h = 0) => new Date(y, m - 1, day, h);
const e = (date: Date, amount: number, category = "food") => ({ date: date.toISOString(), amount, category });

// Three cycles (cycle day 25), the last one in progress on 20 Sep.
const jul = { start: d(2026, 6, 25), end: d(2026, 7, 25) };
const aug = { start: d(2026, 7, 25), end: d(2026, 8, 25) };
const sep = { start: d(2026, 8, 25), end: d(2026, 9, 25) };
const now = d(2026, 9, 20, 10);

describe("Phase 1b: period labels", () => {
  it("names a cycle after the month it runs into, like v1", () => {
    expect(periodLabel(sep, "cycle", now)).toEqual({ chip: "Sep", title: "September cycle", span: "Aug 25 – Sep 24", tick: "Sep" });
    expect(periodLabel({ start: d(2026, 9, 14), end: d(2026, 9, 21) }, "week", now).tick).toBe("9/14");
  });
  it("adds the year only when it isn't the current one", () => {
    expect(periodLabel({ start: d(2025, 12, 1), end: d(2026, 1, 1) }, "month", now).chip).toBe("Dec ’25");
    expect(periodLabel({ start: d(2025, 12, 25), end: d(2026, 1, 25) }, "cycle", now).span).toBe("Dec 25 – Jan 24, 2026");
  });
});

describe("Phase 1b: comparisons", () => {
  const expenses = [
    e(d(2026, 6, 26), 100), e(d(2026, 7, 23), 500), // Jul cycle: 100 by day 26, 600 in all
    e(d(2026, 7, 26), 300), e(d(2026, 8, 22), 900), // Aug cycle: 300 by day 26, 1200 in all
    e(d(2026, 8, 26), 250), e(d(2026, 9, 19), 150), // Sep cycle so far: 400
  ];

  it("compares a period in progress with the same point of the previous one", () => {
    const c = comparePeriods(expenses, [jul, aug, sep], now, "previous");
    expect(c.partial).toBe(true);
    expect(c.current).toBe(400);
    expect(c.baseline).toBe(300); // Aug up to day 26, not the full 1,200
    expect(c.pct).toBe(33);
  });

  it("averages up to 3 earlier periods at the same point", () => {
    const c = comparePeriods(expenses, [jul, aug, sep], now, "average");
    expect(c.baseline).toBe(200); // (100 + 300) / 2
    expect(c.pct).toBe(100);
  });

  it("compares finished periods in full", () => {
    const c = comparePeriods(expenses, [jul, aug], now, "previous");
    expect(c.partial).toBe(false);
    expect(c).toMatchObject({ current: 1200, baseline: 600, diff: 600, pct: 100 });
  });

  it("leaves out earlier periods with no spending, and says when there's no baseline", () => {
    const empty = { start: d(2026, 5, 25), end: d(2026, 6, 25) };
    expect(comparePeriods(expenses, [empty, jul, aug], now, "average").baseline).toBe(600);
    expect(comparePeriods(expenses, [empty, jul], now, "previous")).toMatchObject({ baseline: null, pct: null });
  });

  it("breaks the comparison down by category", () => {
    const list = [...expenses, e(d(2026, 9, 1), 80, "coffee"), e(d(2026, 7, 28), 40, "coffee")];
    const c = comparePeriods(list, [aug, sep], now, "previous");
    const byId = Object.fromEntries(categoryComparison(list, sep, c.baselineRanges).map((x) => [x.id, x]));
    expect(byId.food).toMatchObject({ total: 400, baseline: 300, pct: 33 });
    expect(byId.coffee).toMatchObject({ total: 80, baseline: 40, pct: 100 });
  });

  it("builds chart bars with the average of finished periods only", () => {
    const h = history(expenses, [jul, aug, sep], now);
    expect(h.bars.map((b) => b.total)).toEqual([600, 1200, 400]);
    expect(h.bars.map((b) => b.inProgress)).toEqual([false, false, true]);
    expect(h.average).toBe(900);
  });
});
