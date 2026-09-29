import { describe, it, expect } from "vitest";
import {
  allCategories,
  DEFAULT_CATEGORIES,
  isLabelTaken,
  LEGACY_COLORS,
  nextSortOrder,
  PALETTE,
  resolveCategory,
} from "./categories";
import { ICON_CATALOG, searchIcons } from "./icon-catalog";
import type { CustomCategory } from "./expenses";

const row = (over: Partial<CustomCategory>): CustomCategory => ({
  id: over.id ?? crypto.randomUUID(),
  user_id: "u",
  label: "Row",
  icon: "Star",
  color: "#123456",
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("Phase 1a: default category overrides", () => {
  it("applies a saved override to a default category", () => {
    const rows = [row({ builtin_key: "food", label: "Eating out", icon: "ForkKnife", color: "#eb635e" })];
    const food = resolveCategory("food", rows);
    expect(food).toMatchObject({ id: "food", label: "Eating out", icon: "ForkKnife", color: "#eb635e", builtin: true });
  });

  it("never resolves an override row by its own id", () => {
    const o = row({ id: "o1", builtin_key: "food" });
    expect(resolveCategory("o1", [o]).label).toBe("o1");
  });

  it("hides hidden categories from pickers but still resolves them", () => {
    const rows = [row({ builtin_key: "rent", hidden_at: "2026-09-29T00:00:00Z" })];
    expect(allCategories(rows).map((c) => c.id)).not.toContain("rent");
    expect(allCategories(rows, { includeHidden: true }).map((c) => c.id)).toContain("rent");
    expect(resolveCategory("rent", rows).hidden).toBe(true);
  });
});

describe("Phase 1a: ordering", () => {
  it("keeps v1's order until the user reorders", () => {
    const rows = [row({ id: "b", created_at: "2026-02-01" }), row({ id: "a", created_at: "2026-01-01" })];
    const ids = allCategories(rows).map((c) => c.id);
    expect(ids.slice(0, 8)).toEqual(DEFAULT_CATEGORIES.map((c) => c.id));
    expect(ids.slice(8)).toEqual(["a", "b"]);
  });

  it("follows saved positions, for defaults and custom categories alike", () => {
    const rows = [
      row({ id: "gym", sort_order: 0 }),
      row({ builtin_key: "travel", sort_order: 1 }),
      ...DEFAULT_CATEGORIES.filter((c) => c.id !== "travel").map((c, i) => row({ builtin_key: c.id, sort_order: i + 2 })),
    ];
    expect(allCategories(rows).slice(0, 3).map((c) => c.id)).toEqual(["gym", "travel", "food"]);
  });

  it("puts a new category after every existing one", () => {
    expect(nextSortOrder([])).toBe(DEFAULT_CATEGORIES.length);
    expect(nextSortOrder([row({ sort_order: 20 })])).toBe(21);
  });
});

describe("Phase 1a: names", () => {
  it("rejects duplicate names regardless of case and spaces", () => {
    const rows = [row({ id: "c1", label: "Coffee" })];
    expect(isLabelTaken(" coffee ", rows)).toBe(true);
    expect(isLabelTaken("food", rows)).toBe(true);
    expect(isLabelTaken("Coffee", rows, "c1")).toBe(false); // renaming itself
    expect(isLabelTaken("Pets", rows)).toBe(false);
  });
});

describe("Phase 1a: palette and icons", () => {
  it("offers 40 distinct colors and keeps v1's palette as the first row", () => {
    const all = PALETTE.flatMap((r) => r.colors);
    expect(all).toHaveLength(40);
    expect(new Set(all).size).toBe(40);
    expect(PALETTE[0].colors).toEqual(Object.values(LEGACY_COLORS));
    all.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });

  it("has unique icons that include all of v1's", () => {
    const names = ICON_CATALOG.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThanOrEqual(150);
    ICON_CATALOG.forEach((i) => expect(i.Icon).toBeTruthy());
    const v1 = ["Pizza", "ShoppingCart", "House", "Television", "BeerBottle", "Plug", "Gift", "AirplaneTilt", "Car", "Heart", "Star", "Coffee", "Dog", "Cat", "GameController", "MusicNote", "GraduationCap", "Barbell", "FirstAid", "Scissors", "PaintBrush", "Wrench", "Phone", "Laptop", "Book", "Briefcase", "ShoppingBag", "Baby"];
    v1.forEach((n) => expect(names).toContain(n));
  });

  it("searches names, groups and tags", () => {
    expect(searchIcons("gym").map((i) => i.name)).toContain("Barbell");
    expect(searchIcons("shopping cart").map((i) => i.name)).toContain("ShoppingCart");
    expect(searchIcons("  ").length).toBe(ICON_CATALOG.length);
    expect(searchIcons("zzzz")).toHaveLength(0);
    // Word starts only: "sport" must not match "transport".
    expect(searchIcons("sport").map((i) => i.name)).not.toContain("Bus");
    expect(searchIcons("sport").map((i) => i.name)).toContain("SoccerBall");
  });
});
