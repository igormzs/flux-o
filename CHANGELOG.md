# Changelog

All notable changes to Flux-o are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

The story behind each change, with before/after screenshots, is in [docs/case-study](docs/case-study/README.md).

## [Unreleased]

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
- `20260928120000_settings_on_profiles.sql`, `20260928120100_expense_currency_column.sql`, `20260929090000_default_currency_eur.sql`, `20260929100000_security_advisor_fixes.sql`, `20260929120000_categories_2.sql`. Apply them before deploying.

## [1.0.0] - 2026-09-28

The baseline before the v2 work (git tag `v1.0.0`): expense tracking on Supabase, a Home dashboard with the weekly pulse and spending circle, Insights with salary-cycle months, a Profile with settings, and PWA icons.
