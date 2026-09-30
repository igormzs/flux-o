import { describe, it, expect, beforeEach } from "vitest";
import { resolveCategory, toHex, shade, LEGACY_COLORS, allCategories } from "./categories";
import { splitByCurrency, sumAmounts, formatMoney } from "./currencies";
import { readLegacySettings, settingsFromProfile, settingsToProfile, DEFAULT_SETTINGS, LEGACY_SETTINGS_KEY } from "./settings";
import type { CustomCategory } from "./expenses";

const custom = (id: string, color: string): CustomCategory => ({
  id, user_id: "u", label: id, icon: "Coffee", color, created_at: "2026-01-01",
});

describe("categories", () => {
  it("resolves built-in, custom and unknown ids", () => {
    expect(resolveCategory("food").label).toBe("Food");
    expect(resolveCategory("c1", [custom("c1", "#123abc")]).color).toBe("#123abc");
    expect(resolveCategory("gone").icon).toBe("CurrencyDollar");
  });

  it("maps v1 color tokens to their exact hex", () => {
    expect(toHex("mint")).toBe(LEGACY_COLORS.mint);
    expect(resolveCategory("c1", [custom("c1", "coral")]).color).toBe(LEGACY_COLORS.coral);
    expect(toHex("#ABCDEF")).toBe("#abcdef");
    expect(toHex("not-a-color")).toBe(LEGACY_COLORS.mint);
  });

  it("shade darkens and lightens", () => {
    expect(shade("#808080", -0.5)).toBe("#000000");
    expect(shade("#808080", 0.5)).toBe("#ffffff");
  });

  it("lists built-ins before custom categories", () => {
    const list = allCategories([custom("c1", "mint")]);
    expect(list).toHaveLength(9);
    expect(list[8].id).toBe("c1");
  });
});

describe("currencies", () => {
  it("never adds different currencies together", () => {
    const expenses = [
      { amount: 10, currency: null },
      { amount: 5, currency: "USD" },
      { amount: 64, currency: "EUR" },
      { amount: 6, currency: "EUR" },
    ];
    const { main, others } = splitByCurrency(expenses, "USD");
    expect(sumAmounts(main)).toBe(15);
    expect(others).toEqual({ EUR: 70 });
  });

  it("formats like v1", () => {
    expect(formatMoney(2304.72, "USD")).toBe("$2,304.72");
    expect(formatMoney(64, "EUR")).toBe("€64.00");
    expect(formatMoney(5, "CHF")).toBe("CHF 5.00");
  });
});

describe("settings", () => {
  beforeEach(() => localStorage.clear());

  it("uses defaults until the profile loads", () => {
    expect(settingsFromProfile(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips through the profile columns", () => {
    const patch = settingsToProfile({ cycleDay: 23, currency: "EUR", defaultScope: "month" });
    expect(patch).toEqual({ billing_cycle_day: 23, currency: "EUR", default_scope: "month" });
    expect(settingsFromProfile(patch).cycleDay).toBe(23);
  });

  it("reads v1 localStorage settings and maps the old period names", () => {
    localStorage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify({
      budgetGoal: 1500, currency: "BRL", periodType: "billing_cycle", billingCycleStartDay: 25,
      notifications: { overBudget: false, weeklyReport: true, dailyReminder: false },
    }));
    expect(readLegacySettings()).toEqual({
      budgetGoal: 1500, currency: "BRL", defaultScope: "cycle", cycleDay: 25,
      // The budget alert didn't exist in v1, so it starts off.
      notifications: { overBudget: false, weeklyReport: true, dailyReminder: false, budgetAlert: false },
    });
  });

  it("ignores missing or broken legacy settings", () => {
    expect(readLegacySettings()).toBeNull();
    localStorage.setItem(LEGACY_SETTINGS_KEY, "{not json");
    expect(readLegacySettings()).toBeNull();
  });
});
