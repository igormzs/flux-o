import { describe, it, expect } from "vitest";
import {
  confirmationExpense, currentOccurrences, dueDateIn, dueOccurrences, monthlyTotal, occurrences, ordinal,
  recurringErrors, stillToCome, suggestedAmount, type Confirmation, type RecurringExpense,
} from "./recurring";

const bill = (over: Partial<RecurringExpense>): RecurringExpense => ({
  id: "b", user_id: "u", title: "Bill", amount: 50, currency: null, category: "utilities",
  day_of_month: 5, active: true, starts_on: "2026-01-01", skipped: [], created_at: "2026-01-01T00:00:00Z", ...over,
});
const paid = (recurring_id: string, recurring_period: string, amount: number): Confirmation =>
  ({ id: `${recurring_id}-${recurring_period}`, recurring_id, recurring_period, amount, date: `${recurring_period}-05T12:00:00Z` });

const today = new Date(2026, 8, 30, 10); // Wed 30 Sep 2026
const rent = bill({ id: "rent", title: "Rent", amount: 800, category: "rent", day_of_month: 1 });
const water = bill({ id: "water", title: "Water", amount: 30, day_of_month: 28 });
const gym = bill({ id: "gym", title: "Gym", amount: 35, day_of_month: 31 });

describe("recurring: due dates", () => {
  it("uses the last day in shorter months", () => {
    expect(dueDateIn(new Date(2026, 8, 1), 31)).toBe("2026-09-30");
    expect(dueDateIn(new Date(2027, 1, 1), 30)).toBe("2027-02-28");
    expect(dueDateIn(new Date(2026, 9, 1), 5)).toBe("2026-10-05");
  });
});

describe("recurring: what's due", () => {
  it("marks each bill in last, this and next month", () => {
    const all = occurrences([rent, water, gym], [paid("rent", "2026-09", 800)], today);
    const row = (id: string) => all.filter((o) => o.bill.id === id).map((o) => `${o.dueDate} ${o.status}`);
    expect(row("rent")).toEqual(["2026-08-01 due", "2026-09-01 confirmed", "2026-10-01 upcoming"]);
    expect(row("water")).toEqual(["2026-08-28 due", "2026-09-28 due", "2026-10-28 upcoming"]);
    expect(row("gym")).toEqual(["2026-08-31 due", "2026-09-30 due", "2026-10-31 upcoming"]); // due today counts
  });

  it("doesn't ask for months before the bill was set up", () => {
    const all = occurrences([{ ...water, starts_on: "2026-09-01" }], [], today);
    expect(all.map((o) => o.period)).toEqual(["2026-09", "2026-10"]);
    expect(dueOccurrences(all).map((o) => o.dueDate)).toEqual(["2026-09-28"]);
  });

  it("leaves out skipped months and paused bills", () => {
    const all = occurrences([{ ...water, starts_on: "2026-09-01", skipped: ["2026-09"] }, { ...rent, active: false }], [], today);
    expect(dueOccurrences(all)).toEqual([]);
    expect(all.find((o) => o.period === "2026-09")!.status).toBe("skipped");
  });

  it("shows overdue ones from last month, then this month, on the bill's screen", () => {
    const all = occurrences([water], [], today);
    expect(currentOccurrences(all, water, today).map((o) => o.dueDate)).toEqual(["2026-08-28", "2026-09-28"]);
    const settled = occurrences([water], [paid("water", "2026-08", 31)], today);
    expect(currentOccurrences(settled, water, today).map((o) => o.dueDate)).toEqual(["2026-09-28"]);
  });
});

describe("recurring: amounts", () => {
  it("suggests what was paid last time, else the usual amount", () => {
    expect(suggestedAmount(water, [])).toBe(30);
    expect(suggestedAmount(water, [paid("water", "2026-07", 28.4), paid("water", "2026-08", 33.15), paid("rent", "2026-09", 800)])).toBe(33.15);
  });

  it("adds up what's still to come this cycle, in the main currency", () => {
    const usd = bill({ id: "vpn", title: "VPN", amount: 10, currency: "USD", day_of_month: 10 });
    const bills = [rent, water, gym, usd].map((b) => ({ ...b, starts_on: "2026-09-25" }));
    const all = occurrences(bills, [paid("water", "2026-09", 29)], today);
    // Cycle 25 Sep – 24 Oct: gym 30 Sep (due), rent 1 Oct; water is paid, its October one is outside, VPN is in USD.
    const range = { start: new Date(2026, 8, 25), end: new Date(2026, 9, 25) };
    expect(stillToCome(all, range, "EUR")).toEqual({ total: 835, count: 2 });
    // Bills without their own currency follow the main one.
    expect(stillToCome(all, range, "USD")).toEqual({ total: 845, count: 3 });
  });

  it("totals active bills per month", () => {
    expect(monthlyTotal([rent, water, { ...gym, active: false }], "EUR")).toBe(830);
  });
});

describe("recurring: confirming", () => {
  it("creates the expense on the due day at noon, linked to the bill and month", () => {
    const o = occurrences([water], [], today).find((x) => x.period === "2026-09")!;
    const e = confirmationExpense(o, 31.2, today);
    expect(e).toMatchObject({ title: "Water", amount: 31.2, category: "utilities", currency: null, recurring_id: "water", recurring_period: "2026-09" });
    const d = new Date(e.date);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 28, 12]);
  });

  it("dates an early confirmation today, still for that month", () => {
    const o = occurrences([rent], [paid("rent", "2026-09", 800), paid("rent", "2026-08", 800)], today).find((x) => x.period === "2026-10")!;
    const e = confirmationExpense(o, 800, today);
    expect(new Date(e.date).getDate()).toBe(30);
    expect(e.recurring_period).toBe("2026-10");
  });
});

describe("recurring: the form", () => {
  it("lists what's missing", () => {
    expect(recurringErrors({ title: " ", amount: "", category: "", day: "0" })).toEqual(["Add a name", "Add the usual amount", "Pick a day from 1 to 31", "Pick a category"]);
    expect(recurringErrors({ title: "Rent", amount: "800,50", category: "rent", day: "1" })).toEqual([]);
  });
  it("writes days as ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"]);
  });
});
