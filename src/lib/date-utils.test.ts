import { describe, it, expect } from "vitest";
import {
  countWeeks,
  cycleStart,
  getCycleRange,
  getRecentRanges,
  nominalStartOfCycle,
  samePointIn,
  getCycleWeek,
  getCycleWeekIndex,
  getPreviousRange,
  getScopeRange,
  isInRange,
  lastDayOf,
  rangeFromDays,
} from "./date-utils";

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);
const opts = { cycleDay: 25 };

describe("getCycleRange", () => {
  it("returns the cycle that started this month when the anchor is on/after the cycle day", () => {
    expect(getCycleRange(d(2026, 9, 25, 10), 25)).toEqual({ start: d(2026, 9, 25), end: d(2026, 10, 25) });
    expect(getCycleRange(d(2026, 9, 30), 25)).toEqual({ start: d(2026, 9, 25), end: d(2026, 10, 25) });
  });

  it("returns the cycle that started last month when the anchor is before the cycle day", () => {
    expect(getCycleRange(d(2026, 9, 20), 25)).toEqual({ start: d(2026, 8, 25), end: d(2026, 9, 25) });
    expect(getCycleRange(d(2026, 9, 24, 23, 59), 25)).toEqual({ start: d(2026, 8, 25), end: d(2026, 9, 25) });
  });

  it("crosses the year boundary", () => {
    expect(getCycleRange(d(2027, 1, 10), 25)).toEqual({ start: d(2026, 12, 25), end: d(2027, 1, 25) });
    expect(getCycleRange(d(2026, 12, 28), 25)).toEqual({ start: d(2026, 12, 25), end: d(2027, 1, 25) });
  });

  it("works with cycle day 1 (calendar months)", () => {
    expect(getCycleRange(d(2026, 9, 1), 1)).toEqual({ start: d(2026, 9, 1), end: d(2026, 10, 1) });
  });

  it("snaps cycle days 29–31 to the end of short months", () => {
    // Non-leap February
    expect(getCycleRange(d(2027, 2, 15), 31)).toEqual({ start: d(2027, 1, 31), end: d(2027, 2, 28) });
    expect(getCycleRange(d(2027, 2, 28), 31)).toEqual({ start: d(2027, 2, 28), end: d(2027, 3, 31) });
    // Leap February
    expect(getCycleRange(d(2028, 2, 29), 30)).toEqual({ start: d(2028, 2, 29), end: d(2028, 3, 30) });
    // 30-day month
    expect(getCycleRange(d(2026, 4, 30), 31)).toEqual({ start: d(2026, 4, 30), end: d(2026, 5, 31) });
  });
});

describe("the v1 double-count bug (regression)", () => {
  it("puts an expense on the cycle day in exactly one cycle", () => {
    const paydayBrunch = d(2026, 8, 25, 10);
    const august = getCycleRange(d(2026, 8, 1), 25); // Jul 25 → Aug 25
    const september = getCycleRange(d(2026, 9, 1), 25); // Aug 25 → Sep 25
    expect(isInRange(paydayBrunch, august)).toBe(false);
    expect(isInRange(paydayBrunch, september)).toBe(true);
  });

  it("consecutive cycles share a boundary without overlapping", () => {
    const current = getCycleRange(d(2026, 9, 20), 25);
    const previous = getPreviousRange(current, "cycle", opts)!;
    expect(previous.end).toEqual(current.start);
  });
});

describe("getScopeRange", () => {
  const anchor = d(2026, 9, 20, 10); // a Sunday

  it("month", () => {
    expect(getScopeRange("month", anchor, opts)).toEqual({ start: d(2026, 9, 1), end: d(2026, 10, 1) });
  });

  it("week starts on Monday by default", () => {
    expect(getScopeRange("week", anchor, opts)).toEqual({ start: d(2026, 9, 14), end: d(2026, 9, 21) });
  });

  it("week can start on Sunday", () => {
    expect(getScopeRange("week", anchor, { ...opts, weekStartsOn: 0 })).toEqual({ start: d(2026, 9, 20), end: d(2026, 9, 27) });
  });

  it("last30 includes today", () => {
    const r = getScopeRange("last30", anchor, opts);
    expect(r).toEqual({ start: d(2026, 8, 22), end: d(2026, 9, 21) });
    expect(isInRange(d(2026, 9, 20, 23, 59), r)).toBe(true);
  });

  it("custom returns the given range", () => {
    const custom = rangeFromDays(d(2026, 9, 1), d(2026, 9, 10));
    expect(getScopeRange("custom", anchor, { ...opts, custom })).toBe(custom);
  });

  it("custom without a range throws", () => {
    expect(() => getScopeRange("custom", anchor, opts)).toThrow();
  });

  it("all covers everything", () => {
    const r = getScopeRange("all", anchor, opts);
    expect(isInRange(d(2010, 1, 1), r)).toBe(true);
    expect(isInRange(d(2030, 1, 1), r)).toBe(true);
  });
});

describe("getPreviousRange", () => {
  it("cycle → previous cycle", () => {
    const r = getScopeRange("cycle", d(2026, 9, 20), opts);
    expect(getPreviousRange(r, "cycle", opts)).toEqual({ start: d(2026, 7, 25), end: d(2026, 8, 25) });
  });

  it("month → previous month, including shorter months", () => {
    const march = getScopeRange("month", d(2027, 3, 31), opts);
    expect(getPreviousRange(march, "month", opts)).toEqual({ start: d(2027, 2, 1), end: d(2027, 3, 1) });
  });

  it("week → previous week", () => {
    const r = getScopeRange("week", d(2026, 9, 20), opts);
    expect(getPreviousRange(r, "week", opts)).toEqual({ start: d(2026, 9, 7), end: d(2026, 9, 14) });
  });

  it("custom → the same number of days right before", () => {
    const r = rangeFromDays(d(2026, 9, 11), d(2026, 9, 20)); // 10 days
    expect(getPreviousRange(r, "custom", opts)).toEqual({ start: d(2026, 9, 1), end: d(2026, 9, 11) });
  });

  it("all → null", () => {
    expect(getPreviousRange(getScopeRange("all", new Date(), opts), "all", opts)).toBeNull();
  });
});

describe("helpers", () => {
  it("lastDayOf shows the inclusive end day", () => {
    expect(lastDayOf({ start: d(2026, 8, 25), end: d(2026, 9, 25) })).toEqual(d(2026, 9, 24));
  });

  it("cycle weeks are 7 days, the last one clipped to the cycle end", () => {
    const cycle = { start: d(2026, 8, 25), end: d(2026, 9, 25) }; // 31 days
    expect(countWeeks(cycle)).toBe(5);
    expect(getCycleWeek(cycle, 0)).toEqual({ start: d(2026, 8, 25), end: d(2026, 9, 1) });
    expect(getCycleWeek(cycle, 4)).toEqual({ start: d(2026, 9, 22), end: d(2026, 9, 25) });
    expect(getCycleWeekIndex(cycle, d(2026, 9, 20))).toBe(3);
  });
});

// ── Phase 1b: moved paydays, year scope, comparisons ────────────────────────


describe("Phase 1b: weekend rule", () => {
  // 25 Oct 2026 is a Sunday, 25 Jul 2026 a Saturday, 25 Sep 2026 a Friday.
  it("moves a weekend cycle day to the Friday before", () => {
    expect(cycleStart(2026, 9, 25, { weekendRule: "before" })).toEqual(d(2026, 10, 23));
    expect(cycleStart(2026, 6, 25, { weekendRule: "before" })).toEqual(d(2026, 7, 24));
  });
  it("moves a weekend cycle day to the Monday after", () => {
    expect(cycleStart(2026, 9, 25, { weekendRule: "after" })).toEqual(d(2026, 10, 26));
    expect(cycleStart(2026, 6, 25, { weekendRule: "after" })).toEqual(d(2026, 7, 27));
  });
  it("leaves weekdays and the 'none' rule alone", () => {
    expect(cycleStart(2026, 8, 25, { weekendRule: "before" })).toEqual(d(2026, 9, 25));
    expect(cycleStart(2026, 9, 25, { weekendRule: "none" })).toEqual(d(2026, 10, 25));
  });
  it("shapes the cycle around the moved day", () => {
    // Paid Fri 23 Oct instead of Sun 25 Oct: that weekend belongs to the new cycle.
    const opts = { weekendRule: "before" as const };
    expect(getCycleRange(d(2026, 10, 24, 12), 25, opts)).toEqual({ start: d(2026, 10, 23), end: d(2026, 11, 25) });
    expect(getCycleRange(d(2026, 10, 22, 12), 25, opts)).toEqual({ start: d(2026, 9, 25), end: d(2026, 10, 23) });
  });
  it("can move a cycle into the previous month (cycle day 1 on a Sunday)", () => {
    // 1 Nov 2026 is a Sunday → the November cycle starts Fri 30 Oct.
    const r = getCycleRange(d(2026, 10, 31, 12), 1, { weekendRule: "before" });
    expect(r.start).toEqual(d(2026, 10, 30));
  });
});

describe("Phase 1b: one-off payday moves", () => {
  const overrides = { "2026-09": "2026-09-23" };
  it("uses the override for that cycle only", () => {
    expect(getCycleRange(d(2026, 9, 24, 12), 25, { overrides })).toEqual({ start: d(2026, 9, 23), end: d(2026, 10, 25) });
    expect(getCycleRange(d(2026, 9, 22, 12), 25, { overrides })).toEqual({ start: d(2026, 8, 25), end: d(2026, 9, 23) });
  });
  it("beats the weekend rule", () => {
    expect(cycleStart(2026, 9, 25, { weekendRule: "before", overrides: { "2026-10": "2026-10-27" } })).toEqual(d(2026, 10, 27));
  });
  it("ignores overrides more than 10 days away", () => {
    expect(cycleStart(2026, 8, 25, { overrides: { "2026-09": "2026-09-01" } })).toEqual(d(2026, 9, 25));
  });
  it("finds the usual start of a moved cycle", () => {
    expect(nominalStartOfCycle({ start: d(2026, 9, 23), end: d(2026, 10, 25) }, 25)).toEqual(d(2026, 9, 25));
    expect(nominalStartOfCycle({ start: d(2026, 10, 30), end: d(2026, 12, 1) }, 1)).toEqual(d(2026, 11, 1));
  });
  it("keeps consecutive cycles gap-free and non-overlapping", () => {
    const opts = { cycleDay: 25, payday: { weekendRule: "before" as const, overrides } };
    const ranges = getRecentRanges(getCycleRange(d(2027, 3, 1), 25, opts.payday), "cycle", opts, 18);
    expect(ranges).toHaveLength(18);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i].start).toEqual(ranges[i - 1].end);
  });
});

describe("Phase 1b: year scope and comparisons", () => {

  it("scopes a calendar year", () => {
    expect(getScopeRange("year", d(2026, 9, 20), opts)).toEqual({ start: d(2026, 1, 1), end: d(2027, 1, 1) });
    expect(getPreviousRange({ start: d(2026, 1, 1), end: d(2027, 1, 1) }, "year", opts)).toEqual({ start: d(2025, 1, 1), end: d(2026, 1, 1) });
  });
  it("lists recent periods oldest first", () => {
    const months = getRecentRanges(getScopeRange("month", d(2026, 9, 20), opts), "month", opts, 3);
    expect(months.map((r) => r.start.getMonth() + 1)).toEqual([7, 8, 9]);
  });
  it("compares a period in progress with the same point of an earlier one", () => {
    const current = { start: d(2026, 8, 25), end: d(2026, 9, 25) };
    const previous = { start: d(2026, 7, 25), end: d(2026, 8, 25) };
    // 20 Sep 10:00 is 26 days + 10 h into the current cycle.
    expect(samePointIn(previous, current, d(2026, 9, 20, 10))).toEqual({ start: d(2026, 7, 25), end: d(2026, 8, 20, 10) });
    // A finished period compares in full.
    expect(samePointIn(previous, current, d(2026, 10, 1))).toEqual(previous);
  });
});
