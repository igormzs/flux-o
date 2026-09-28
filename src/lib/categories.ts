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

export const DEFAULT_CATEGORIES: readonly CategoryInfo[] = [
  { id: "food", label: "Food", icon: "Pizza", color: LEGACY_COLORS.mint },
  { id: "grocery", label: "Grocery", icon: "ShoppingCart", color: LEGACY_COLORS.peach },
  { id: "rent", label: "Rent", icon: "House", color: LEGACY_COLORS.lavender },
  { id: "subscriptions", label: "Subs", icon: "Television", color: LEGACY_COLORS.electric },
  { id: "nightlife", label: "Drinks", icon: "BeerBottle", color: LEGACY_COLORS.pink },
  { id: "utilities", label: "Utilities", icon: "Plug", color: LEGACY_COLORS.yellow },
  { id: "selfcare", label: "Self-care", icon: "Gift", color: LEGACY_COLORS.teal },
  { id: "travel", label: "Travel", icon: "AirplaneTilt", color: LEGACY_COLORS.coral },
];

const FALLBACK_COLOR = LEGACY_COLORS.mint;

/** Accepts a hex color or a v1 token name and returns a hex color. */
export function toHex(color: string | null | undefined): string {
  if (!color) return FALLBACK_COLOR;
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  return LEGACY_COLORS[color] ?? FALLBACK_COLOR;
}

export function resolveCategory(id: string, customCategories: CustomCategory[] = []): CategoryInfo {
  const builtIn = DEFAULT_CATEGORIES.find((c) => c.id === id);
  if (builtIn) return builtIn;
  const custom = customCategories.find((c) => c.id === id);
  if (custom) return { id: custom.id, label: custom.label, icon: custom.icon, color: toHex(custom.color) };
  return { id, label: id, icon: "CurrencyDollar", color: FALLBACK_COLOR };
}

/** All categories the user can pick from, built-in first. */
export function allCategories(customCategories: CustomCategory[] = []): CategoryInfo[] {
  return [...DEFAULT_CATEGORIES, ...customCategories.map((c) => resolveCategory(c.id, customCategories))];
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
