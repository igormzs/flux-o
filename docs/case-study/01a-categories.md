# Phase 1a: Categories 2.0

> **In one line:** "Categories feel very limiting" was the top piece of v1 feedback. Categories can now be created, edited, renamed, hidden, deleted and reordered, with 40 colors plus any custom color and 209 searchable icons, and no existing expense had to change.

## The problem

In v1:

- **Only 8 colors existed**, so custom categories had to reuse the defaults' colors. In the demo data "Coffee" is the same mint as "Food", and "Gym" the same blue as "Subs".
- **Only 28 icons**, in one unsearchable grid.
- **Nothing could be changed after saving.** Custom categories couldn't be edited or deleted, and the 8 defaults lived in the app code, so they couldn't be renamed, recolored or hidden.
- **The order was fixed**: defaults first, then custom categories in creation order.

## What users can do now

| Action | v1 | Phase 1a |
|---|---|---|
| Create a category | Inline form in Add expense, 8 colors, 28 icons | Editor sheet with a live preview, 40 colors + custom color, 209 searchable icons |
| Edit a custom category | ✗ | ✓ name, color, icon |
| Rename or recolor a default category | ✗ | ✓ |
| Delete a custom category | ✗ | ✓ its expenses are moved to a category you choose first |
| Remove a default category | ✗ | Hide it (and restore it later) |
| Reorder | ✗ | Drag, or arrow keys on the handle |
| Duplicate names | Allowed ("Coffee" and "coffee") | Rejected, ignoring case and spaces |
| Where | Add expense only | **Profile → Categories**, plus "New" and "Manage" in Add expense |

## Decisions & trade-offs

| Decision | Why | Trade-off accepted |
|---|---|---|
| **Defaults stay in code; user changes are "override" rows** (`custom_categories.builtin_key = 'food'`) | Every existing expense keeps `category = 'food'`, so there is no data migration and nothing to get wrong for the 4 real users. New users get sensible defaults with zero rows. | Two kinds of rows in one table. `resolveCategory()` hides the difference from every screen. |
| **Override rows are created lazily**, the first time a default is edited, hidden or reordered | Users who never touch categories store nothing extra. | The first reorder writes 8 rows. |
| **Deleting moves expenses first, in one database function** (`delete_category`) | An expense must never point at a category that no longer exists. Doing the move and the delete in one transaction means a failure leaves everything as it was. | One Postgres function to maintain (mirrored in the screenshot mock). |
| **Defaults are hidden, not deleted** | They live in the app code, so "delete" can't really remove them, and hiding is reversible. | The dialog says "Hide" instead of "Delete" for defaults, which is honest but a second word to learn. |
| **The function runs as the caller (`SECURITY INVOKER`), not callable by anonymous users** | Row-level security still applies, so it can only touch the caller's rows. This follows the Security Advisor lesson from Phase 0. | None. |
| **Positions are saved for every category on reorder** | One consistent order. Until the first reorder, v1's order is kept. | A reorder is two batched requests (defaults and custom rows have different unique keys). |
| **Order updates optimistically** | A dragged row doesn't snap back while the save is in flight. It rolls back with a message if the save fails. | Slightly more code in the mutation hook. |
| **The palette is generated in OKLCH**: 4 tones × 8 hues, plus v1's 8 colors as the first row | Each row has the same perceived lightness, so no color is harder to read than its neighbours. Keeping v1's row means existing categories still match a swatch. | Hand-picked palettes can look warmer. This one is more even. |
| **Any color stays readable**: dark colors are lifted on the dark theme, light ones capped on the light theme, and text on a filled tile picks black or white | Users can now type any hex, including near-black or near-white. | In light mode the "Soft" row looks more muted than on dark, because it is shown as it will actually render. |
| **The icon catalog loads on demand** | Each Phosphor icon carries all six weights. Bundling 209 up front would add about 160 KB (gzipped) to every page load, for a picker most sessions never open. | The picker shows "Loading icons…" for a moment the first time. v1's 28 icons stay in the main bundle, so existing categories never flash. |
| **Search matches the start of words** in names, groups and tags | "gym" finds the barbell and "sport" finds balls, but "sport" doesn't match "tran**sport**". | Tags are hand-written, so some synonyms will be missing. |

## What changed on screen

Details and screenshots are in [visual-changes.md → Phase 1a](visual-changes.md#phase-1a-categories-20).

- A new **Categories** screen: a list with drag handles, "Default" labels, and a **Hidden** section with Restore.
- A new **category editor** sheet, used for creating and editing: live preview, name with validation, 5 × 8 swatches, custom color (system picker or hex), and grouped, searchable icons.
- A **delete dialog** that shows how many expenses the category has and asks where to move them.
- **Profile** gets a Categories card with a preview of the first 7 categories.
- **Add expense:** "New" opens the same editor, and a "Manage" link opens the Categories screen. The picker follows the user's order and names.
- **Light mode, selected tile:** the text is now black or white, whichever reads better (v1 always used white, which was hard to read on yellow).

## What changed in the code

| Area | v1 / Phase 0 | Phase 1a |
|---|---|---|
| Default categories | Constant, can't be changed | Constant plus override rows (`builtin_key`), merged by `resolveCategory()` |
| Order | Defaults, then custom by `created_at` | `allCategories()` sorts by `sort_order`, falling back to v1's order |
| Writes | `createCustomCategory` only | `useCategoryMutations()`: create, update, reorder (optimistic), remove, restore |
| Delete | — | `delete_category(p_category, p_move_to)` Postgres function |
| Colors | 8 tokens | `PALETTE` (40 hex) + any hex; CSS clamps lightness and computes `--cat-ink` |
| Icons | 28, hard-coded in two files | `icon-catalog.ts` (209, grouped + tagged, lazy chunk) + `icon-loader.ts` |
| New UI | — | `pages/Categories.tsx`, `components/categories/{CategoryEditorSheet, ColorPicker, IconPicker, DeleteCategoryDialog}.tsx` |
| Tests | 31 | **41** unit tests, plus `npm run smoke:categories` (22 end-to-end checks in a real browser) |

### Migration

- [`20260929120000_categories_2.sql`](../../supabase/migrations/20260929120000_categories_2.sql) adds `builtin_key`, `sort_order` and `hidden_at` to `custom_categories`, a unique key on `(user_id, builtin_key)`, an index on `expenses (user_id, category)`, and the `delete_category` function.

## How it was verified

- `npm test`: 41 passing. New tests cover overrides, hidden categories, ordering (before and after a reorder), the next position for new categories, duplicate names, the palette (40 unique colors, v1's row intact) and icons (unique, all of v1's included, search).
- `npm run smoke:categories`: 22 checks against the mocked API. They cover editing color, icon and hex; renaming a default; rejecting a duplicate name; creating from both screens; keyboard and drag reorder (and that the order is saved); deleting Coffee with its 48 expenses moved; hiding and restoring Rent; the Add expense picker following the new order; and no console errors.
- `tsc`, `eslint` (no new warnings) and `vite build` pass. Main bundle: 386 → 401 KB gzipped (+4%). Icon catalog: separate 160 KB chunk, loaded on demand.
- Screenshots of every screen in [`screenshots/v2/phase-1a/`](screenshots/v2/phase-1a/), including 4 new screens.

## Deploy notes

Apply `20260929120000_categories_2.sql` in Supabase **before** deploying. The app reads the new columns and calls `delete_category`.
