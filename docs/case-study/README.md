# Flux-o: v1 → v2 case study

This folder records how Flux-o changed from **v1.0.0** (git tag `v1.0.0`) to **v2.0.0**: what users asked for, what we changed on screen and in the code, and why.

| Document | What it covers |
|---|---|
| [visual-changes.md](visual-changes.md) | A running log of every UI change, with v1 and v2 screenshots side by side |
| [structural-changes.md](structural-changes.md) | Architecture, data model and code-quality changes, with before/after diagrams |
| [00-foundations.md](00-foundations.md) | Phase 0: settings sync, one date-range module, one category resolver, a currency column |
| 01a-categories.md | Phase 1a: Categories 2.0 *(to be written)* |
| 01b-insights-scope.md | Phase 1b: Insights scope & comparisons *(to be written)* |
| 02-fast-backfill.md | Phase 2: batch add and paste/CSV import *(to be written)* |
| [../../CHANGELOG.md](../../CHANGELOG.md) | Release notes, one entry per phase |

## Where v2 started

v1 was used every day by its author and a few friends. Their feedback came down to three pain points:

1. **"Categories feel very limiting."** There were 8 colors and 28 icons, and a category couldn't be edited, deleted or renamed once created. Custom categories ended up sharing colors with the defaults.
2. **"Catching up after a weekend is slow."** Each expense had to be entered one at a time through the full form.
3. **"My cycle is 25th to 25th, but payday moves."** Insights was locked to a hard-coded 25th-to-25th cycle, with no way to pick another scope or compare it with earlier periods of the same kind.

A code review at the start of v2 also found problems nobody had reported (details in [structural-changes.md](structural-changes.md)):

- Home and Insights each defined their own billing cycle. Insights counted an expense on the 25th in **two** cycles.
- Currency was stored as a text prefix inside the note, so a €64 train ticket was added to totals as $64.
- A saved light theme was reset to dark on every reload.
- Settings lived only in the browser and didn't sync between phone and desktop.
- Category colors were defined separately in 6 files.
- There were no real tests.

## How the screenshots are made

Every screenshot in this folder comes from [`scripts/case-study/screenshots.ts`](../../scripts/case-study/screenshots.ts):

- The app runs against a **mocked Supabase API** ([`mock-supabase.ts`](../../scripts/case-study/mock-supabase.ts)), so no real account or data is involved.
- It always uses the same **demo dataset** ([`demo-data.ts`](../../scripts/case-study/demo-data.ts)): June–September 2026 for a demo user, "Alex".
- The clock is frozen at **20 Sep 2026**.
- Each screen is captured at **mobile 390×844** and **desktop 1440×900**, in **dark and light** themes.

Because the data, date and viewports never change, a v1 image and its v2 counterpart show exactly the same situation. File names follow `<screen>.<viewport>.<theme>[.full].png` in every version folder:

```
screenshots/v1/            ← captured from the v1.0.0 tag
screenshots/v2/phase-0/    ← after each phase
screenshots/v2/phase-1a/ …
```

To recapture:

```sh
npm run screenshots -- --out docs/case-study/screenshots/v2/<phase>
# v1 (from a worktree of the tag)
git worktree add ../flux-o-v1 v1.0.0 && ln -s "$PWD/node_modules" ../flux-o-v1/node_modules
npm run screenshots -- --app-dir ../flux-o-v1 --out docs/case-study/screenshots/v1
```

## v1 vs v2 at a glance

*This table is completed as each phase ships.*

| | v1.0.0 | v2.0.0 |
|---|---|---|
| Category colors | 8 fixed | — |
| Category icons | 28 | — |
| Edit / delete / reorder categories | ✗ | — |
| Insights scopes | Salary cycle (25th, hard-coded) or a custom range | — |
| Moved-payday handling | ✗ | — |
| Logging a weekend of expenses (10 items) | 10 × full form | — |
| Settings sync across devices | ✗ (browser only) | — |
| Multi-currency totals | Summed as if all the same currency | — |
| Places that define category colors | 6 files | — |
| Places that read settings | 8 files (localStorage) | — |
| Automated tests | 1 placeholder | — |
