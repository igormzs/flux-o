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

## Phase 0: Foundations

Phase 0 deliberately changes little on screen. Every visible difference below comes from the data being correct now. Full write-up: [00-foundations.md](00-foundations.md).

### Home → Total spending: other currencies shown separately
**Why:** v1 added a €64 train ticket to the dollar total as if it were $64.
**Change:** the total adds up the main currency only (**$2,240.72**, v1 $2,304.72). Other currencies are listed under it as *"+ €64.00 in other currency"*. The same line appears on the Insights total.

| v1 | v2 (Phase 0) |
|---|---|
| ![](screenshots/v1/home.mobile.dark.png) | ![](screenshots/v2/phase-0/home.mobile.dark.png) |

### Home → Spending Circle label: "Aug 25 – Sep 24"
**Why:** v1 showed "Aug 25 – Sep 25", so the next cycle's first day overlapped this one.
**Change:** ranges are half-open internally, and the label shows the last day actually included.

### Insights → comparison and breakdown
**Why:** v1 counted the $111.66 spent on Aug 25 in both the August and September cycles, and summed euros as dollars.
**Change:** the September vs August pulse is now **−$23.52 (−1%)** (v1 −$71.18, −3%). *Travel* leaves the breakdown because its only expense this cycle was in EUR. The "biggest increase" callout now also considers custom categories.

| v1 | v2 (Phase 0) |
|---|---|
| ![](screenshots/v1/insights.desktop.dark.full.png) | ![](screenshots/v2/phase-0/insights.desktop.dark.full.png) |

### Profile → Settings
**Why:** the cycle day was only shown when "billing cycle" was the display period, although the Home total always uses it. Settings didn't sync between devices.
**Change:** "Billing Cycle Start Day" is always visible, with a one-line explanation. The display-period options are *Billing cycle · Month · Week · Last 30 days · All time*. Settings save to the account.

| v1 | v2 (Phase 0) |
|---|---|
| ![](screenshots/v1/profile.mobile.dark.full.png) | ![](screenshots/v2/phase-0/profile.mobile.dark.full.png) |

### Light theme persists
**Why:** v1 reset a saved light theme to dark on every reload.
**Change:** the theme is applied before the first paint and kept.

### Category colors: same look, new engine
**Why:** colors were defined in six places, and Phase 1a needs any color to work.
**Change:** no visual change intended. Tiles, chips and chart gradients all derive from one hex value per category. In light mode the tone is computed with OKLCH (same hue and saturation, darker) instead of a second hand-picked palette.

| v1 light | v2 light (Phase 0) |
|---|---|
| ![](screenshots/v1/add-expense-filled.mobile.light.png) | ![](screenshots/v2/phase-0/add-expense-filled.mobile.light.png) |

