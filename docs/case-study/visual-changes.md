# Visual changes log

Every change a user can see goes here, newest phase last. Each entry gives the **screen → what changed → why (the feedback it answers)**, followed by v1 and v2 screenshots of the same screen with the same demo data.

Screenshots are in [`screenshots/`](screenshots/). Captions use the mobile dark theme unless noted; every screen also exists in light theme and at desktop size under the same name.

---

## v1 baseline (tag `v1.0.0`)

| Home | Add expense | New category | Insights |
|---|---|---|---|
| ![](screenshots/v1/home.mobile.dark.png) | ![](screenshots/v1/add-expense-filled.mobile.dark.png) | ![](screenshots/v1/new-category.mobile.dark.png) | ![](screenshots/v1/insights.mobile.dark.png) |

What the baseline shows, in the demo data:

- **Categories can't be told apart.** "Coffee" uses the same mint as "Food", and "Gym" the same blue as "Subs", because only 8 colors exist ([new-category](screenshots/v1/new-category.mobile.dark.png)).
- **The New Category form** has 28 icons in a fixed grid and 8 color dots. Once saved, a category can't be edited, deleted or renamed.
- **Insights** has one way to look at the data: a month chip, read as "the salary cycle ending on the 25th of that month", or a custom date range ([desktop](screenshots/v1/insights.desktop.dark.full.png)).
- **Mixed currencies** are shown with the wrong symbol: a €64 train ticket appears as "$64.00" under Travel and is counted in the dollar total.
- **The theme doesn't persist.** Choosing light mode works until the next reload, then the app is dark again. The v1 light-mode screenshots were captured by forcing the theme in the test harness.

---

<!-- Phase entries are appended below. Template:

## Phase X: <name>

### <Screen>: <what changed>
**Why:** <feedback / problem>
**Change:** <what's different>

| v1 | v2 |
|---|---|
| ![](screenshots/v1/<screen>.mobile.dark.png) | ![](screenshots/v2/<phase>/<screen>.mobile.dark.png) |
-->
