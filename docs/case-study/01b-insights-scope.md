# Phase 1b: Insights scope & comparisons

> **In one line:** "My cycle is 25th to 25th, but payday moves." Insights can now show a cycle, month, week, year or custom range. It compares each one fairly with earlier periods of the same kind, and a cycle can start on the day the salary actually arrived.

## The problem

In v1 (and still after Phase 0):

- **Insights showed one kind of period:** the salary cycle, as month chips for the current year only, or a custom date range.
- **It compared an unfinished period with a finished one.** On 20 Sep, day 27 of 31, the September cycle was compared with the *whole* August cycle, so it always looked cheaper than it was.
- **Paydays that move weren't supported.** If the salary arrived on Friday the 23rd because the 25th was a Sunday, the weekend's spending was counted in the old cycle.
- **There was no longer view.** You couldn't see whether this cycle was high or low compared with the last several.

### What the comparison said on 20 Sep (demo data)

| | Compared with | Result | Reading |
|---|---|---|---|
| v1 | All of August, which also double-counted the 25th | −$71.18 (−3%) | "Spending less" ✗ |
| Phase 0 | All of the August cycle | −$23.52 (−1%) | "Spending less" ✗ |
| **Phase 1b** | **August cycle up to day 27** ($2,115.60) | **+$125.12 (+6%)** | **"Spending more"** ✓ |

The first two compared 27 days with 31. At the same point in the cycle, September is actually 6% higher.

## What users can do now

| | v1 / Phase 0 | Phase 1b |
|---|---|---|
| Period types | Cycle (as month chips) or custom range | **Cycle · Month · Week · Year · Custom** |
| Choosing a period | This year's 12 months | The last 12 periods of the chosen type. The current one is marked with a dot |
| Comparison | vs the whole previous period | vs the previous period **or the average of the last 3**, cut **at the same point** while the period is still running |
| History | — | Bar chart of the last 6 cycles or months, 8 weeks or 3 years, with the average as a dashed line. Tap a bar to open that period |
| Inside the period | By week | By week, **by day** (for a week) or **by month** (for a year) |
| Category breakdown | Totals | Totals plus **▲/▼ % change** against the same baseline |
| Payday on a weekend | — | Setting: start the cycle **on that day**, the **Friday before** or the **Monday after** |
| Payday moved for one cycle | — | **"Payday moved?"** Pick the day the salary arrived, up to 10 days either side |
| Status | — | Header shows "Day 27 of 31" and "Started Fri, Aug 21 · payday moved" |
| Links | — | The period is in the URL (`?scope=month&at=2026-08-01`), so Back and bookmarks work |

## Decisions & trade-offs

| Decision | Why | Trade-off accepted |
|---|---|---|
| **Compare at the same point while a period is running** | Otherwise every unfinished period looks cheaper than the one before, which is what v1 and Phase 0 showed. | The baseline shown changes day by day ("Last cycle by this point: $2,115.60"). It's labelled so it isn't a surprise. |
| **"Average" is of up to 3 earlier periods, leaving out any with no spending** | Three periods smooth out one-off months without reaching too far back. Empty periods are usually "before I used Flux-o" and would pull the average down. | A genuinely empty period is also left out. That's rare, and the chart still shows it. |
| **One-off paydays stored as `{ "2026-08": "2026-08-21" }` on the profile** | It's one small JSON field that's already loaded and synced, instead of a new table and more requests. The key is the month the cycle usually starts in, so it stays valid if the cycle day changes. | If the user changes their cycle day, old overrides may no longer apply. They're ignored harmlessly. |
| **A move is limited to 10 days either way** | Cycles are about 30 days apart, so ±10 days can never make two cycles overlap or skip one. | A payday moved by more than 10 days isn't supported. |
| **The weekend rule is a setting, one-off moves are per cycle** | Most "moved paydays" follow a rule (paid on the Friday before a weekend). Set once, it fixes every future cycle. The one-off is for bank holidays and exceptions. | Two concepts, but they're shown together in the "Payday moved?" sheet. |
| **Home uses the same rules** (`scopeOptionsFor(settings)`) | Home and Insights must never disagree about when a cycle starts. This was Phase 0's lesson. | None. |
| **One request per view** | The selected period and the earlier ones it's compared with are fetched as one date range, then grouped in the browser. | Year view fetches 3 years of expenses, which is fine at personal-finance volumes. |
| **Year isn't a "default view" option** | Home's Spending Circle doesn't need a year, and the database constraint stays unchanged. | None. |

## What changed on screen

Details and screenshots are in [visual-changes.md → Phase 1b](visual-changes.md#phase-1b-insights-scope--comparisons).

- Period-type tabs, and chips for recent periods instead of the current year's months.
- A header naming the period with its dates, a "Day X of Y" badge, and cycle-start details.
- The total card says "so far" for a running period. Its comparison can be switched between the last period and the average, with the baseline amount shown.
- New "Last N cycles/months/weeks/years" chart.
- "By week / by day / by month" replaces the fixed weekly chart. The peak cards follow the same unit.
- Category breakdown shows a % change per category.
- The "Payday moved?" sheet. Profile gets a weekend rule.

## What changed in the code

| Area | Phase 0 | Phase 1b |
|---|---|---|
| Cycles | `getCycleRange(anchor, cycleDay)` | `getCycleRange(anchor, cycleDay, payday?)`; `cycleStart()` applies overrides and then the weekend rule |
| Scopes | cycle, month, week, last30, custom, all | + **year**; `getRecentRanges()`, `samePointIn()` |
| Insights maths | Inline in `Insights.tsx` | `lib/insights.ts`: `comparePeriods`, `categoryComparison`, `history`, `timeBuckets`, `periodLabel` (all unit-tested) |
| Settings | 6 fields | + `weekendRule`, `cycleOverrides`; `scopeOptionsFor(settings)` used by Home and Insights |
| UI | `MonthPicker` (removed) | `insights/PeriodPicker` (tabs + chips), `insights/HistoryChart`, `insights/PaydaySheet` |
| Tests | 41 unit | **62** unit + `npm run smoke:insights` (22 browser checks) |

### Migration

- [`20260930090000_payday_rules.sql`](../../supabase/migrations/20260930090000_payday_rules.sql) adds `profiles.payday_weekend_rule` (`none`/`before`/`after`, default `none`) and `profiles.cycle_start_overrides` (JSON object, default `{}`). Nothing changes for existing users until they use the new options.

## How it was verified

- `npm test`: 62 passing. New tests cover the weekend rule (Saturday and Sunday, before and after), a cycle moving into the previous month (cycle day 1 on a Sunday), overrides beating the rule, overrides more than 10 days away being ignored, **18 consecutive cycles with no gaps or overlaps**, the year scope, the same-point comparison, averages leaving out empty periods, per-category change, chart bars and labels.
- `npm run smoke:insights`: 22 browser checks. They cover the default view, each tab, chips, Back, both baselines, totals matching the data, saving and resetting a one-off payday, the previous cycle ending where the moved one starts, **Home's total agreeing with Insights after a move**, a date too far away being refused, the weekend rule set in Profile moving a Sunday payday to Friday, and no console errors.
- `npm run smoke:categories` still passes. `tsc`, `eslint` (no new warnings) and `vite build` pass. Main bundle: 401 → 406 KB gzipped.

## Deploy notes

Apply `20260930090000_payday_rules.sql` in Supabase **before** deploying. The app reads and writes the two new profile columns.
