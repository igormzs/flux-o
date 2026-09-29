import type { Database, Json } from "@/integrations/supabase/types";
import { DEFAULT_CYCLE_DAY, DEFAULT_WEEK_STARTS_ON, type Scope } from "./date-utils";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

/** Scopes that can be a default view (custom needs dates, so it can't). */
export type DefaultScope = Exclude<Scope, "custom">;

export interface NotificationSettings {
  overBudget: boolean;
  weeklyReport: boolean;
  dailyReminder: boolean;
}

/**
 * User settings, stored on the profile row since v2 (v1 kept them in
 * localStorage, so they didn't sync between devices).
 */
export interface Settings {
  currency: string;
  budgetGoal: number;
  cycleDay: number;
  defaultScope: DefaultScope;
  weekStartsOn: 0 | 1;
  notifications: NotificationSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: "EUR",
  budgetGoal: 2000,
  cycleDay: DEFAULT_CYCLE_DAY,
  defaultScope: "cycle",
  weekStartsOn: DEFAULT_WEEK_STARTS_ON,
  notifications: { overBudget: true, weeklyReport: false, dailyReminder: false },
};

export function settingsFromProfile(row: Partial<ProfileRow> | null | undefined): Settings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    currency: row.currency ?? DEFAULT_SETTINGS.currency,
    budgetGoal: Number(row.budget_goal ?? DEFAULT_SETTINGS.budgetGoal),
    cycleDay: row.billing_cycle_day ?? DEFAULT_SETTINGS.cycleDay,
    defaultScope: (row.default_scope as DefaultScope) ?? DEFAULT_SETTINGS.defaultScope,
    weekStartsOn: row.week_starts_on === 0 ? 0 : 1,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(row.notifications as Partial<NotificationSettings> | null) },
  };
}

export function settingsToProfile(patch: Partial<Settings>): ProfileUpdate {
  const out: ProfileUpdate = {};
  if (patch.currency !== undefined) out.currency = patch.currency;
  if (patch.budgetGoal !== undefined) out.budget_goal = patch.budgetGoal;
  if (patch.cycleDay !== undefined) out.billing_cycle_day = patch.cycleDay;
  if (patch.defaultScope !== undefined) out.default_scope = patch.defaultScope;
  if (patch.weekStartsOn !== undefined) out.week_starts_on = patch.weekStartsOn;
  if (patch.notifications !== undefined) out.notifications = patch.notifications as unknown as Json;
  return out;
}

// ── One-time import of v1 localStorage settings ─────────────────────────────

export const LEGACY_SETTINGS_KEY = "fluxo_settings";

const LEGACY_PERIOD_TO_SCOPE: Record<string, DefaultScope> = {
  week: "week",
  month: "month",
  billing_cycle: "cycle",
  custom: "cycle",
  all: "all",
};

/** Reads v1's localStorage settings, if this browser has any. */
export function readLegacySettings(): Partial<Settings> | null {
  try {
    const raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) return null;
    const v1 = JSON.parse(raw);
    const out: Partial<Settings> = {};
    if (typeof v1.currency === "string") out.currency = v1.currency;
    if (typeof v1.budgetGoal === "number") out.budgetGoal = v1.budgetGoal;
    if (typeof v1.billingCycleStartDay === "number") out.cycleDay = v1.billingCycleStartDay;
    if (typeof v1.periodType === "string" && LEGACY_PERIOD_TO_SCOPE[v1.periodType]) {
      out.defaultScope = LEGACY_PERIOD_TO_SCOPE[v1.periodType];
    }
    if (v1.notifications && typeof v1.notifications === "object") out.notifications = { ...DEFAULT_SETTINGS.notifications, ...v1.notifications };
    return out;
  } catch {
    return null;
  }
}

export function clearLegacySettings() {
  try {
    localStorage.removeItem(LEGACY_SETTINGS_KEY);
  } catch {
    // Storage can be unavailable (private mode); nothing to clear then.
  }
}
