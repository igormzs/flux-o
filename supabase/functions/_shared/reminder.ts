/**
 * The catch-up reminder: a nudge when nothing has been logged for a few days.
 * No I/O, so it's unit-tested with the app.
 */
import { localParts } from "./weekly.ts";

/** Local hour from which the reminder goes out (evening, when there's time to catch up). */
export const REMINDER_HOUR = 19;

/** Days without logging that trigger a reminder: one nudge at each, then silence. */
export const REMINDER_DAYS = [3, 7] as const;

export interface Reminder {
  /** "2026-09-27:3": the last day something was logged and the stage, so each nudge is sent once. */
  key: string;
  days: number;
  title: string;
  body: string;
  url: string;
}

const dayNumber = (p: { year: number; month: number; day: number }) => Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;

/**
 * The reminder due at `now`, or null. `lastLoggedAt` is when the user last
 * added an expense (its created_at, not the expense's own date, so
 * backfilling old expenses counts as logging today).
 */
export function catchUpReminder(now: Date, timeZone: string, lastLoggedAt: Date | null): Reminder | null {
  if (!lastLoggedAt) return null; // nothing logged yet: a new account, not a lapse
  const today = localParts(now, timeZone);
  if (today.hour < REMINDER_HOUR) return null;
  const last = localParts(lastLoggedAt, timeZone);
  const days = dayNumber(today) - dayNumber(last);
  const stage = [...REMINDER_DAYS].reverse().find((d) => days >= d);
  if (!stage) return null;
  const lastDay = `${last.year}-${String(last.month).padStart(2, "0")}-${String(last.day).padStart(2, "0")}`;
  return {
    key: `${lastDay}:${stage}`,
    days,
    title: stage >= 7 ? "Nothing logged for a week" : `Nothing logged for ${days} days`,
    body: "Catch up in one go: type or paste your expenses and save them together.",
    url: "/add",
  };
}
