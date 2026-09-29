import type { CSSProperties } from "react";
import type { CustomCategory } from "./expenses";

/**
 * Single source of truth for how a category looks (label, icon, color).
 *
 * v1 defined category colors in six places (CSS variables, two hex gradient
 * maps and three Tailwind class maps). Every screen now calls
 * `resolveCategory()` and styles with `categoryStyle()` plus the `.cat-*`
 * classes in index.css, so adding a color is a one-line change.
 */

export interface CategoryInfo {
  id: string;
  label: string;
  icon: string;
  /** Hex color, e.g. "#5cd6ad". */
  color: string;
  /** One of the 8 categories that ship with the app (hidden, never deleted). */
  builtin: boolean;
  hidden: boolean;
}

/**
 * v1 stored colors as token names. These are the exact hex values of v1's
 * dark-theme tokens, so existing categories keep their color.
 */
export const LEGACY_COLORS: Record<string, string> = {
  mint: "#5cd6ad",
  teal: "#53c6c6",
  lavender: "#a68cd9",
  electric: "#55a6f6",
  pink: "#e87db3",
  yellow: "#f6ce55",
  peach: "#f0a875",
  coral: "#e97963",
};

const builtin = (id: string, label: string, icon: string, color: string): CategoryInfo => ({
  id, label, icon, color, builtin: true, hidden: false,
});

export const DEFAULT_CATEGORIES: readonly CategoryInfo[] = [
  builtin("food", "Food", "Pizza", LEGACY_COLORS.mint),
  builtin("grocery", "Grocery", "ShoppingCart", LEGACY_COLORS.peach),
  builtin("rent", "Rent", "House", LEGACY_COLORS.lavender),
  builtin("subscriptions", "Subs", "Television", LEGACY_COLORS.electric),
  builtin("nightlife", "Drinks", "BeerBottle", LEGACY_COLORS.pink),
  builtin("utilities", "Utilities", "Plug", LEGACY_COLORS.yellow),
  builtin("selfcare", "Self-care", "Gift", LEGACY_COLORS.teal),
  builtin("travel", "Travel", "AirplaneTilt", LEGACY_COLORS.coral),
];

export const isBuiltinKey = (id: string) => DEFAULT_CATEGORIES.some((c) => c.id === id);

/**
 * The swatches offered in the category editor, one row per tone and one
 * column per hue. Generated in OKLCH so each row has the same perceived
 * lightness; "Classic" is v1's palette, unchanged. Any other hex works too
 * (the editor has a custom color picker).
 */
export const PALETTE: readonly { name: string; colors: readonly string[] }[] = [
  { name: "Classic", colors: Object.values(LEGACY_COLORS) },
  { name: "Soft", colors: ["#febab4", "#fac092", "#e0ce89", "#afdda5", "#85e1d5", "#95d7fe", "#c8c7fe", "#f6b7e0"] },
  { name: "Bright", colors: ["#fe9088", "#f99b44", "#d2b223", "#7ecb6c", "#10cfbf", "#4ac1fe", "#aca9ff", "#f28cd2"] },
  { name: "Deep", colors: ["#eb635e", "#d97a05", "#b09308", "#55ad40", "#01ac9f", "#01a1df", "#8d82f8", "#d765b6"] },
  { name: "Muted", colors: ["#bf9a96", "#ba9f89", "#ada585", "#96ac91", "#85aea8", "#8aaabd", "#a1a1c0", "#b99aae"] },
];

const FALLBACK_COLOR = LEGACY_COLORS.mint;

/** Accepts a hex color or a v1 token name and returns a hex color. */
export function toHex(color: string | null | undefined): string {
  if (!color) return FALLBACK_COLOR;
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  return LEGACY_COLORS[color] ?? FALLBACK_COLOR;
}

/** The user's saved changes to a default category, if any. */
export function builtinOverride(key: string, rows: CustomCategory[] = []) {
  return rows.find((r) => r.builtin_key === key);
}

export function resolveCategory(id: string, customCategories: CustomCategory[] = []): CategoryInfo {
  const builtIn = DEFAULT_CATEGORIES.find((c) => c.id === id);
  if (builtIn) {
    const o = builtinOverride(id, customCategories);
    return o
      ? { ...builtIn, label: o.label, icon: o.icon, color: toHex(o.color), hidden: !!o.hidden_at }
      : builtIn;
  }
  const custom = customCategories.find((c) => c.id === id && !c.builtin_key);
  if (custom) {
    return {
      id: custom.id, label: custom.label, icon: custom.icon, color: toHex(custom.color),
      builtin: false, hidden: !!custom.hidden_at,
    };
  }
  return { id, label: id, icon: "CurrencyDollar", color: FALLBACK_COLOR, builtin: false, hidden: false };
}

/**
 * Every category with its list position. Until the user reorders, positions
 * follow v1's order: defaults first, then custom categories by creation.
 */
function positioned(rows: CustomCategory[]) {
  const customs = rows
    .filter((r) => !r.builtin_key)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const entries = [
    ...DEFAULT_CATEGORIES.map((c, i) => ({ info: resolveCategory(c.id, rows), pos: builtinOverride(c.id, rows)?.sort_order ?? i })),
    ...customs.map((c, i) => ({ info: resolveCategory(c.id, rows), pos: c.sort_order ?? DEFAULT_CATEGORIES.length + i })),
  ];
  // Array.prototype.sort is stable, so ties keep defaults before customs.
  return entries.sort((a, b) => a.pos - b.pos);
}

/** Categories in the user's order. Hidden ones are left out unless asked for. */
export function allCategories(
  customCategories: CustomCategory[] = [],
  { includeHidden = false }: { includeHidden?: boolean } = {},
): CategoryInfo[] {
  return positioned(customCategories)
    .map((e) => e.info)
    .filter((c) => includeHidden || !c.hidden);
}

/** The position for a newly created category: after every existing one. */
export function nextSortOrder(customCategories: CustomCategory[] = []): number {
  return Math.max(-1, ...positioned(customCategories).map((e) => e.pos)) + 1;
}

/** Case-insensitive, ignoring surrounding spaces: "coffee " clashes with "Coffee". */
export function isLabelTaken(label: string, customCategories: CustomCategory[] = [], exceptId?: string) {
  const want = label.trim().toLocaleLowerCase();
  return allCategories(customCategories, { includeHidden: true })
    .some((c) => c.id !== exceptId && c.label.trim().toLocaleLowerCase() === want);
}

/** Sets `--cat` for the `.cat-*` classes in index.css. */
export function categoryStyle(color: string): CSSProperties {
  return { "--cat": toHex(color) } as CSSProperties;
}

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

/** Lighten (positive) or darken (negative) a hex color by `amount` of lightness (0–1). */
export function shade(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(toHex(hex));
  return hslToHex(h, s, Math.min(1, Math.max(0, l + amount)));
}

/** Two stops for chart gradients (SVG can't use the CSS `.cat-*` classes). */
export function gradientStops(color: string): { from: string; to: string } {
  const base = toHex(color);
  return { from: base, to: shade(base, -0.08) };
}
