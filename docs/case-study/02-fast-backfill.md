# Phase 2: Fast backfill

> **In one line:** "Catching up after a weekend is slow." A new **Add expenses** screen takes many expenses at once. You can type rows (the date and category carry over), or paste a note, a bank statement or a CSV file. It guesses categories, flags duplicates, and saves everything in one request with Undo.

## The problem

In v1 every expense went through the full form, one at a time: open the sheet, type a title, type an amount, pick a category, change the date if it wasn't today, save, and repeat. Catching up on a weekend of 10 expenses meant 10 trips through that form, most of them with a date change.

## What users can do now

Open it from Add expense → **Add several** (or go to `/add`).

| | v1 | Phase 2 |
|---|---|---|
| Several expenses | One form per expense | One screen of rows, saved together |
| Typing | Every field for every expense | Title → Enter → amount → Enter makes the next row, with the **date and category carried over** |
| Categories | Picked every time | **Guessed**: from your past expenses with the same title, then a category named in the title, then keywords ("Uber" → Travel). A carried-over category gives way to a better guess |
| From a note | — | Paste `Sat groceries 62,30`: weekday, `19/09`, `yesterday` or ISO dates; amounts in either decimal style; `€`/`EUR` currencies |
| From a bank / spreadsheet | — | Paste a table or choose a CSV file. It finds the delimiter, the header (English and Portuguese names), or works out the columns from the values. **Incoming money is skipped** |
| Ambiguous dates | — | If 05/06 could be either way, one tap re-reads the file as day/month or month/day |
| Duplicates | — | Anything matching a saved expense (same day, same amount, similar title), or a line pasted twice, is **unticked** with the reason shown |
| Mistakes | — | Rows missing something are highlighted with what's missing, and nothing is saved until they're fixed or unticked |
| After saving | — | One request, a toast with **Undo** (removes the whole batch), and Home updates straight away |
| Leaving by accident | — | Unsaved rows are kept for the browser tab (session storage) |

### Interactions for 10 weekend expenses (estimated)

| Flow | Actions |
|---|---|
| v1: the form, 10 times | about 60 (per expense: open, title, amount, category, date, save) |
| Phase 2: typing | about 25 (title and amount per row. Date and category usually carry over or are guessed) |
| Phase 2: pasting a note or statement | **5** (Add several, Paste, paste, Read, Save), plus fixing anything flagged |

These are counts of taps and fields, worked out from the flows, not timed user tests.

## Decisions & trade-offs

| Decision | Why | Trade-off accepted |
|---|---|---|
| **Review before saving, always** | Parsing free text is a guess. Seeing every row, with hints on why a category or an untick happened, keeps the user in control. | One extra step compared with "import and forget". |
| **A parser for notes, not just CSV** | The weekend case is usually a few lines in a notes app, not a bank export. | The rules are simple: date first, amount last. Unusual lines come through as rows to fix, not errors. |
| **Negative amounts are spending when a file has both signs** | Bank exports list salary and refunds with the expenses, and those aren't expenses. | A file with only positive numbers is treated as all spending. |
| **Duplicates are unticked, not removed** | The user decides. A genuine second coffee at the same price can be ticked back on. | The user has to look at flagged rows. |
| **Guess order: history → category name → keyword** | Your own past choice is the strongest signal. Keywords are a fallback, in English and Portuguese. | New merchants with no keyword stay uncategorised until picked. |
| **Saved at 12:00 on the chosen day** | A time in the middle of the day can't be moved to a different date by any time zone. | Bulk-added expenses don't have a real time of day. |
| **One insert for the batch** | All or nothing. Nothing is left half-saved, and it's one request instead of dozens. | A limit of 500 rows per batch. |
| **No database change** | The existing `expenses` columns (including Phase 0's `currency`) cover everything. | None. |
| **The screen loads on demand** | Most visits never open it. The main download stays at 407 KB. | A short delay the first time it opens. |

## What changed on screen

Details and screenshots are in [visual-changes.md → Phase 2](visual-changes.md#phase-2-fast-backfill).

- **Add expense** sheet: a new **Add several** button in its header.
- New **Add expenses** screen: Type / Paste or import tabs, a list of editable rows, a summary after reading, and a sticky **Save N expenses** button with totals per currency.

## What changed in the code

| Area | Before | Phase 2 |
|---|---|---|
| Parsing | — | `lib/import.ts`: `parseAmount`, `parseDate`, `detectDateOrder`, `parseLines`, `detectDelimiter`, `parseTable`, `guessCategory`, `matchCategoryName`, `markDuplicates`, `draftErrors`, `draftToExpense` (all pure and unit-tested) |
| Data | `saveExpense` (one) | + `saveExpenses` (batch insert), `deleteExpenses` (Undo), `getExpenseHistory` (title → category) |
| Hooks | `save`, `update`, `remove` | + `saveMany`, `removeMany`, `useExpenseHistory` |
| UI | — | `pages/AddExpenses.tsx` (lazy route `/add`), `components/add/{DraftRow, CategoryPicker}.tsx` |
| Theme | Native date pickers always light | `color-scheme` follows the app theme |
| Tests | 62 unit | **106** unit + `npm run smoke:backfill` (23 browser checks) |

## How it was verified

- `npm test`: 106 passing, 44 of them new, for:
  - 10 amount formats and 13 date forms
  - day/month detection
  - a weekend note, a Portuguese bank statement with salary skipped, quoted CSV with category and currency columns, debit/credit columns, a headerless TSV, and ambiguous dates
  - the category guess order and hidden categories
  - plural category names ("Groceries" → Grocery)
  - duplicates (against saved expenses and within the batch)
  - validation, and saving at noon
- `npm run smoke:backfill`: 23 checks in a real browser against the mocked API:
  - the entry point, Enter navigation, and the date and category carrying over
  - keyword guesses, and pasting a note with a line that's already saved (flagged and unticked)
  - a line in euros, validation blocking the save
  - a bank CSV file with income skipped
  - rows kept after leaving the page
  - saving 8 in one go at noon, Home showing them, Undo removing all 8
  - no console errors
- `npm run smoke:categories` and `npm run smoke:insights` still pass. `tsc`, `eslint` (no new warnings) and `vite build` pass. Main bundle 407 KB gzipped; the Add expenses screen is a separate 14 KB chunk.

## Deploy notes

No migration. Phase 2 can be deployed as is.
