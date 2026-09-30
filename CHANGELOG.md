# Changelog

All notable changes to Flux-o are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

The story behind each change, with before/after screenshots, is in [docs/case-study](docs/case-study/README.md).

## [Unreleased]

### Added — Budget alert
- A budget bar on Home's total card: spending against the goal, recurring expenses still to come as a lighter segment, and "On track to go X over" when the two together pass the goal. A goal of 0 hides it.
- The budget alert (Profile → Notifications, off until switched on): a heads-up when spending plus recurring expenses still to come will pass the goal, and an alert when spending itself passes it. Once each per pay cycle, between 9:00 and 21:00 local time.
- The server works out the pay cycle (weekend rule and moved paydays included) and "still to come" itself; unit tests compare both with the app's own calculation day by day.

### Changed — Budget alert
- Profile's "Monthly Budget Goal" is now "Budget goal", with a note that it's counted per pay cycle.
- v1's stored "over budget" switch is ignored. It was on for every account but never sent anything.

### Added — Recurring expenses
- Recurring expenses (Profile → Recurring expenses): rent, utilities and subscriptions set up once with a name, usual amount, day of the month and category. They can be paused or deleted; deleting keeps past expenses.
- Home shows the ones whose day has come, each with its amount pre-filled from what was paid last time (or the usual amount) and editable. Confirm one, Confirm all, or Skip this month. Nothing is added automatically, and every action has Undo.
- "Still to come this cycle": the total of recurring expenses not yet confirmed in the current pay cycle.
- A recurring expense can be confirmed early from its screen; it's dated today and counted for that month.
- Migration `20261002090000_recurring_expenses.sql`: `recurring_expenses`, plus `expenses.recurring_id` and `recurring_period` (one expense per bill per month).
- `npm run smoke:recurring`: 28 browser checks.

### Added — Notifications
- Push notifications, turned on per device in Profile → Notifications ("Turn on for this device"). Works on iPhone (iOS 16.4+) when Flux-o is on the Home Screen, and in Chrome, Edge and Firefox. In iPhone Safari the card explains how to add Flux-o to the Home Screen first.
- The weekly report: Mondays at 9:00 in the user's time zone, with last week's total in the main currency, the change from the week before and the top category. Tapping it opens Insights on that week. Sent once per week, and retried the next hour if nothing got through.
- "Send a test": a preview of the report on every device the user turned on.
- The `notify` Edge Function, run hourly by `pg_cron`. Web Push encryption (RFC 8291) and VAPID (RFC 8292) are written on Web Crypto, with no dependency.
- Migration `20261001100000_push_notifications.sql`: `push_subscriptions`, `notification_log`, `profiles.timezone` and the hourly schedule.
- The catch-up reminder (replaces the "Daily reminder" switch): around 19:00 local time once nothing has been logged for 3 days, once more after 7 days, then quiet until something is logged. "Logged" is when an expense was added, not its date. Tapping it opens Add several.
- `npm run smoke:push`: 17 checks in real Google Chrome, including a notification delivered through Google's push service.

### Changed — Notifications
- The notification settings save when switched, instead of waiting for the settings Save button. Saving one setting no longer discards unsaved edits to the others.
- "Over budget alert" is marked Coming soon. It was a switch that did nothing.
- Switches in the Notifications card flip at once, and every save includes all switches flipped so far, so two quick taps can't undo each other.

### Fixed — Polish after testing
- Tapping a text field on iPhone no longer zooms the page (iOS Safari zooms into any field under 16px). Fields are 16px on phones and keep their compact size from tablet width up.
- Switching between light and dark is one cross-fade of the whole page. Before, every element faded its own colors at slightly different speeds, and on iOS the text on the Home card briefly showed boxes of the old theme.
- "Clear all expense data" deletes the user's expenses and receipt photos after a confirmation. In v1 it only showed a "Data cleared" message.
- `npm run smoke:fixes`: 22 checks in WebKit (Safari's engine).

### Security
- Receipts and avatars are private. They're shown through signed links that work for an hour, only for their owner. New uploads store the file's path, and v1's stored URLs keep working. Migration `20261001090000_private_images.sql`.

### Removed
- `bun.lock` and `bun.lockb`, left over from the project template. The project uses npm, and `package-lock.json` is the only lockfile.

### Added — Phase 2: Fast backfill
- An Add expenses screen (`/add`, via "Add several" in the Add Expense sheet) for many expenses at once.
- Typing rows: Enter moves to the amount, then to a new row that keeps the date and category.
- Pasting notes ("Sat groceries 62,30"), bank statements or spreadsheets, or choosing a CSV file. Weekday and numeric dates, both decimal styles and currency symbols are understood, and incoming money is skipped.
- Category guesses from past expenses with the same title, category names and keywords.
- Duplicate detection against saved expenses and within the batch (unticked, with the reason).
- One-request save with Undo. Unsaved rows are kept for the browser tab.
- `npm run smoke:backfill`: 23 browser checks.

### Changed — Phase 2
- Native controls such as date pickers follow the app's dark or light theme.

### Added — Phase 1b: Insights scope & comparisons
- Insights period types: Cycle, Month, Week, Year and Custom, with chips for the last 12 periods of each.
- Comparisons with the previous period or the average of the last 3. A period still in progress is compared at the same point, not with a whole finished period.
- A history chart of the last 6 cycles or months, 8 weeks or 3 years with their average. Tap a bar to open that period.
- Per-category % change, "Day X of Y", and by day / by week / by month breakdowns.
- "Payday moved?": start one cycle on the day the salary actually arrived (up to 10 days either side).
- A weekend rule (Profile): when the cycle day is on a weekend, start on that day, the Friday before or the Monday after. Home and Insights both follow it.
- The Insights period is in the URL, so Back and bookmarks work.
- `npm run smoke:insights`: 22 browser checks.

### Removed — Phase 1b
- `MonthPicker` (replaced by the period tabs and chips).

### Added — Phase 1a: Categories 2.0
- A Categories screen (Profile → Categories): edit, reorder (drag or arrow keys), hide and restore categories.
- A category editor with a live preview, 40 swatches plus any custom color (picker or hex), and 209 icons grouped and searchable.
- Default categories can be renamed, recolored, re-iconed and hidden.
- Deleting a category asks where to move its expenses and does both in one database transaction.
- Duplicate category names are rejected, ignoring case and spaces.
- "New" and "Manage" in Add expense open the editor and the Categories screen.
- `npm run smoke:categories`: an end-to-end check of every category flow against the mocked API.

### Changed — Phase 1a
- Text on a selected category tile is black or white, whichever is more readable. Very dark or very light custom colors are adjusted per theme so they stay readable.
- The icon catalog loads on demand (a separate 160 KB chunk). v1's 28 icons stay in the main bundle.


### Added
- Case-study tooling: a reproducible screenshot runner against a mocked Supabase API with a fixed demo dataset (`npm run screenshots`).
- The v1 baseline screenshots and documentation in `docs/case-study/`.
- Settings (currency, budget, billing-cycle day, default view, notifications) are stored on the account and sync across devices. Settings saved in the browser by v1 are imported automatically once.
- `expenses.currency` column. Totals add up the main currency only and list other currencies separately ("+ €64.00 in other currency").
- 31 unit tests for date ranges, categories, currencies and settings.

### Changed
- One date-range module with half-open ranges replaces six functions. The billing-cycle day from Profile now applies to the Home total and to Insights, not just the Home chart.
- Category colors come from a single resolver and accept any hex color; v1 color names keep their exact colors.
- All data fetching goes through react-query, so saving an expense refreshes every screen.
- Profile: the billing-cycle day is always visible. Display-period options are Billing cycle, Month, Week, Last 30 days and All time.

### Fixed
- Anyone with the app's public key could list every file in the receipt-image bucket. Listing is now limited to your own files.
- The sign-up trigger function could be called directly through the API.
- Expenses on the cycle start day were counted in two cycles.
- Amounts in different currencies were added together.
- A custom Insights date range left out its last day.
- The "biggest increase" insight ignored custom categories.
- A saved light theme was reset to dark on reload.

### Removed
- The unused `storage.ts` (the v1 prototype's localStorage data model) and `constants.ts`.

### Migrations
- `20260928120000_settings_on_profiles.sql`, `20260928120100_expense_currency_column.sql`, `20260929090000_default_currency_eur.sql`, `20260929100000_security_advisor_fixes.sql`, `20260929120000_categories_2.sql`, `20260930090000_payday_rules.sql`. Apply them before deploying.

## [1.0.0] - 2026-09-28

The baseline before the v2 work (git tag `v1.0.0`): expense tracking on Supabase, a Home dashboard with the weekly pulse and spending circle, Insights with salary-cycle months, a Profile with settings, and PWA icons.
