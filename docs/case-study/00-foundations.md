# Phase 0: Foundations

> **In one line:** v2 features were going to sit on three shaky parts of v1: dates, settings and currency. Phase 0 rebuilds those parts first and fixes four data bugs along the way, while keeping the UI almost unchanged.

## The problem

None of the three v2 features (flexible categories, fast backfill, flexible Insights scope) could be built cleanly on v1:

- **Insights scopes** need date logic that is correct and shared. v1 had three cycle functions that disagreed with each other (see [structural-changes.md](structural-changes.md#date-range-logic-three-functions-that-disagree)).
- **Moved paydays and a user-chosen cycle day** need settings that every screen reads the same way. v1 read settings from localStorage in 8 files, and Insights ignored them entirely.
- **Richer category colors** need colors defined in one place. v1 defined them in six.
- **Bulk import** needs a proper currency per expense. v1 hid it inside the note.

## Decisions & trade-offs

| Decision | Why | Trade-off accepted |
|---|---|---|
| **Half-open ranges `[start, end)` everywhere** | Consecutive periods share a boundary and never overlap, which removes the double-count bug by construction. | Labels have to show `end − 1 day` ("Aug 25 – Sep 24"), handled by `lastDayOf()`. |
| **A cycle day past a month's end snaps to its last day** | A cycle day of 31 has to mean something in February. | None visible; covered by tests. |
| **Settings on `profiles`, not a new table** | It's one row per user, already fetched on every screen, and already covered by RLS. | The profile row gets wider (7 columns). |
| **Import v1 localStorage settings once, then lock** | Users keep their settings without doing anything. `settings_migrated_at` stops a second device with stale settings from overwriting the first. | The first device opened after the upgrade decides the settings. |
| **`expenses.currency` is nullable (null = main currency)** | Matches v1's meaning for notes without a prefix, and the migration needs no knowledge of each user's main currency. | Code resolves `currency ?? main`, through one helper (`expenseCurrency`). |
| **No exchange rates. Other currencies are listed next to the total instead of added in** | An honest total beats a wrong one, and a free FX source is out of scope. | The €64 train ticket isn't in the "Total spending" figure; it appears under it. |
| **Category colors become hex + CSS classes driven by a `--cat` variable** | Any color works, which Phase 1a's color picker needs. Light mode is derived automatically. | Light-mode tones come from an OKLCH formula instead of hand-picked tokens (visually within a few %). |
| **react-query only** | One cache: a save invalidates every list and chart that shows expenses. | None. |

## What changed on screen

The UI is intentionally close to v1; the visible changes are consequences of correct data. Details and screenshots are in [visual-changes.md → Phase 0](visual-changes.md#phase-0-foundations).

- **The Home total no longer includes the €64 ticket.** It shows **$2,240.72** (v1: $2,304.72) with *"+ €64.00 in other currency"* below it.
- **The Spending Circle label is "Aug 25 – Sep 24"** (v1: "Aug 25 – Sep 25", which overlapped the next cycle).
- **Insights → September comparison: −$23.52 / −1%** (v1: −$71.18 / −3%). v1 had counted **$111.66** of Aug 25 spending in both August and September.
- **Travel drops out of September's category breakdown**, because its only expense this cycle was in euros.
- **Profile:** the cycle start day is always shown, with a one-line explanation. The display-period options are *Billing cycle · Month · Week · Last 30 days · All time* ("custom" moved to Insights, where it belongs).
- **The light theme now survives a reload.**

## What changed in the code

| Area | v1 | v2 |
|---|---|---|
| Date ranges | `getPeriodRange`, `getSalaryCycleRange`, `getActiveSalaryCycleRange`, `getCycleWeekRange`, `getPreviousCycleWeekRange`, `getEquivalentPeriodLastMonth` + hard-coded `SALARY_CYCLE_START_DAY` | `getScopeRange`, `getPreviousRange`, `getCycleRange`, `getCycleWeek` in [date-utils.ts](../../src/lib/date-utils.ts) |
| Settings | `JSON.parse(localStorage…)` in 8 files | `useSettings()` / `useUpdateSettings()` in [useProfile.ts](../../src/hooks/useProfile.ts), mapping in [settings.ts](../../src/lib/settings.ts) |
| Category look | 6 color definitions | `resolveCategory()` + `categoryStyle()` in [categories.ts](../../src/lib/categories.ts), `.cat-*` classes in `index.css` |
| Currency | `[EUR]` prefix in `note`, `parseNote`/`stringifyNote` | `expenses.currency` column; `splitByCurrency`, `formatMoney` in [currencies.ts](../../src/lib/currencies.ts) |
| Data fetching | Imperative fetch of every expense + react-query | react-query only; `useExpenses(range)`, `useRecentExpenses`, mutations invalidate `["expenses"]` |
| Theme | Effect order reset light → dark | Inline script in `index.html` applies it before first paint; the toggle only writes on click |
| Tests | 1 placeholder | **31 tests**: date ranges (incl. the double-count regression), categories, currency split, settings mapping |
| Dead code | `storage.ts`, `constants.ts` | Removed |

### Migrations

- [`20260928120000_settings_on_profiles.sql`](../../supabase/migrations/20260928120000_settings_on_profiles.sql): adds settings columns (with defaults and checks) and an `updated_at` trigger.
- [`20260928120100_expense_currency_column.sql`](../../supabase/migrations/20260928120100_expense_currency_column.sql): adds `expenses.currency`, moves the `[XXX]` prefix into it and strips it from notes.

## Bugs fixed

| Bug | Effect in the demo data |
|---|---|
| An expense on the cycle day was counted in two cycles | $111.66 counted in both August and September |
| Different currencies were added together | €64 counted as $64 |
| A custom Insights range left out its last day | Picking Sep 1–10 showed Sep 1–9 |
| The Profile cycle day was ignored by the Home total and by Insights | Changing it only moved the Home chart |
| The biggest-increase insight skipped custom categories | Coffee/Gym never appeared |
| The light theme was lost on reload | — |

## How it was verified

- `npm test`: 31 passing, including cycle days 29–31, February, leap years, year boundaries, and the double-count regression.
- A scripted smoke test against the mocked API confirmed: v1 settings in localStorage are uploaded once and then cleared; the Home chart follows the imported view; a new expense is saved with a real `currency` and appears without a reload; no console errors.
- `tsc`, `eslint` and `vite build` pass.
- Screenshots of every screen in [`screenshots/v2/phase-0/`](screenshots/v2/phase-0/).

## Deploy notes

The code requires both migrations. **Apply them to Supabase before deploying this build**; the app writes `expenses.currency` and the new `profiles` columns.
