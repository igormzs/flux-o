/**
 * Phase 1a end-to-end check: drives the real app against the mocked Supabase
 * API and verifies every category flow (create, edit, rename a default,
 * duplicate names, keyboard + drag reorder, delete with moved expenses,
 * hide/restore, create from Add expense).
 *
 *   npm run smoke:categories
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { applyV2Migrations, buildDemoData, DEMO_NOW } from "./demo-data.ts";
import { demoSession, installMockSupabase, MOCK_AUTH_STORAGE_KEY, MOCK_SUPABASE_KEY, MOCK_SUPABASE_URL } from "./mock-supabase.ts";
import { rpcHandlers } from "./mock-rpc.ts";

const port = 5198;
const proc = spawn("node_modules/.bin/vite", ["--port", String(port), "--strictPort"], {
  env: { ...process.env, VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: MOCK_SUPABASE_KEY, VITE_SUPABASE_ANON_KEY: MOCK_SUPABASE_KEY },
  stdio: ["ignore", "pipe", "pipe"],
});
await new Promise((r) => proc.stdout.on("data", (b) => b.toString().includes("Local:") && r(null)));
const tables = applyV2Migrations(buildDemoData());
tables.profiles[0].settings_migrated_at = "2026-09-01T00:00:00Z";
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: `http://localhost:${port}`, viewport: { width: 390, height: 844 } });
await installMockSupabase(ctx, tables, rpcHandlers);
await ctx.addInitScript(([k, s]) => localStorage.setItem(k as string, JSON.stringify(s)), [MOCK_AUTH_STORAGE_KEY, demoSession()] as const);
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(DEMO_NOW));
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) process.exitCode = 1; };
const cats = () => tables.custom_categories;
const COFFEE = "c0ffee00-0000-4000-8000-000000000001";
/** Opens a row's editor; centers it first so the bottom nav and toasts can't cover it. */
const edit = async (rowId: string, label: string) => {
  const btn = page.getByTestId(`category-row-${rowId}`).getByRole("button", { name: new RegExp(`^Edit ${label}`) });
  await btn.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await btn.click();
};
const GYM = "c0ffee00-0000-4000-8000-000000000002";

try {
  await page.goto("/categories");
  await page.getByTestId("category-row-food").waitFor();
  ok(await page.locator('[data-testid^="category-row-"]').count() === 10, "lists 8 defaults + 2 custom");

  // Edit a custom category: color + icon
  await edit(COFFEE, "Coffee");
  await page.getByRole("radio", { name: "Deep orange" }).click();
  await page.locator("#icon-search").fill("beans");
  await page.getByRole("radio", { name: "Coffee bean" }).click();
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForTimeout(500);
  const coffee = cats().find((c) => c.id === COFFEE)!;
  ok(coffee.color === "#d97a05" && coffee.icon === "CoffeeBean", `custom edited (${coffee.color}, ${coffee.icon})`);

  // Custom hex
  await edit(GYM, "Gym");
  await page.locator("#category-hex").fill("#2a1b5e");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForTimeout(500);
  ok(cats().find((c) => c.id === GYM)!.color === "#2a1b5e", "custom hex saved");

  // Rename a default
  await edit("food", "Food");
  await page.locator("#category-name").fill("Eating out");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForTimeout(500);
  const foodRow = cats().find((c) => c.builtin_key === "food");
  ok(foodRow?.label === "Eating out", "default renamed via override row");
  ok(await page.getByTestId("category-row-food").getByText("Eating out", { exact: true }).count() === 1, "list shows new name");

  // Duplicate name
  await page.getByTestId("create-category").click();
  await page.locator("#category-name").fill("coffee");
  await page.getByRole("button", { name: "Create Category" }).click();
  ok(await page.getByText("You already have a category called").count() === 1, "duplicate name rejected");
  await page.locator("#category-name").fill("Pets");
  await page.locator("#icon-search").fill("paw");
  await page.getByRole("radio", { name: "Paw print" }).click();
  await page.getByRole("button", { name: "Create Category" }).click();
  await page.waitForTimeout(500);
  const pets = cats().find((c) => c.label === "Pets");
  ok(pets?.icon === "PawPrint" && pets.sort_order === 10, `created Pets (sort_order ${pets?.sort_order})`);
  ok(await page.getByTestId(`category-row-${pets?.id}`).count() === 1, "Pets appears in the list");

  // Keyboard reorder: move Gym to the top
  const handle = page.getByTestId(`category-row-${GYM}`).getByRole("button", { name: /Reorder Gym/ });
  for (let i = 0; i < 9; i++) { await handle.focus(); await page.keyboard.press("ArrowUp"); await page.waitForTimeout(150); }
  await page.waitForTimeout(800);
  const firstRow = await page.locator('[data-testid^="category-row-"]').first().getAttribute("data-testid");
  ok(firstRow === `category-row-${GYM}`, "Gym moved to the top");
  ok(cats().find((c) => c.id === GYM)?.sort_order === 0 && cats().filter((c) => c.builtin_key).length === 8, "order saved for all categories");

  // Pointer drag: drag Travel up two slots
  const before = await page.locator('[data-testid^="category-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  const travelHandle = page.getByTestId("category-row-nightlife").getByRole("button", { name: /Reorder/ });
  const box = (await travelHandle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let y = 0; y <= 150; y += 5) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - y, { steps: 2 }); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(900);
  const after = await page.locator('[data-testid^="category-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  ok(after.indexOf("category-row-nightlife") < before.indexOf("category-row-nightlife"), `drag moved Drinks up (${before.indexOf("category-row-nightlife")} → ${after.indexOf("category-row-nightlife")})`);
  const travelSaved = cats().find((c) => c.builtin_key === "nightlife")?.sort_order;
  ok(travelSaved === after.indexOf("category-row-nightlife"), `drag order saved (${travelSaved})`);

  // Delete a custom category with expenses → move to Eating out
  const coffeeCount = tables.expenses.filter((e) => e.category === COFFEE).length;
  await edit(COFFEE, "Coffee");
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByText(`It has ${coffeeCount} expense`).waitFor();
  ok(await page.getByRole("button", { name: "Move & delete" }).isDisabled(), "must choose a target first");
  await page.getByRole("alertdialog").getByRole("radio", { name: "Eating out" }).click();
  await page.getByRole("button", { name: "Move & delete" }).click();
  await page.waitForTimeout(700);
  ok(!cats().some((c) => c.id === COFFEE), "Coffee deleted");
  ok(tables.expenses.filter((e) => e.category === COFFEE).length === 0 && coffeeCount > 0, `${coffeeCount} expenses moved`);

  // Hide a default with expenses, then restore
  await edit("rent", "Rent");
  await page.getByRole("button", { name: "Hide" }).click();
  await page.getByRole("alertdialog").getByRole("radio", { name: "Utilities" }).click();
  await page.getByRole("button", { name: "Move & hide" }).click();
  await page.waitForTimeout(700);
  ok(!!cats().find((c) => c.builtin_key === "rent")?.hidden_at, "Rent hidden");
  ok(await page.getByTestId("category-row-rent").count() === 0 && await page.getByText("Hidden").count() >= 1, "Rent in Hidden section");
  await page.getByRole("button", { name: "Restore" }).click();
  await page.waitForTimeout(600);
  ok(await page.getByTestId("category-row-rent").count() === 1, "Rent restored");

  // Add expense picker follows the new order + names; new category from the sheet
  await page.goto("/");
  await page.getByText("Recent Transactions").waitFor();
  await page.locator('[data-testid="add-expense"]').first().click();
  await page.waitForTimeout(600);
  const tiles = await page.locator('[data-testid^="category-"]:not([data-testid="category-preview"])').evaluateAll((els) => els.map((e) => e.textContent));
  ok(tiles[0] === "Gym", `picker starts with Gym (${tiles.slice(0, 3).join(", ")})`);
  ok(tiles.includes("Eating out") && !tiles.includes("Coffee"), "picker shows renamed, not deleted");
  await page.getByTestId("new-category").click();
  await page.locator("#category-name").fill("Books");
  await page.getByRole("button", { name: "Create Category" }).click();
  await page.waitForTimeout(700);
  const books = cats().find((c) => c.label === "Books");
  ok(!!books && (await page.getByTestId(`category-${books.id}`).getAttribute("class"))?.includes("cat-solid"), "created from Add expense and selected");
  ok(errors.length === 0, `no console errors ${errors.slice(0, 3).join(" | ")}`);
} catch (e) {
  console.error("FAILED:", (e as Error).message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await browser.close();
  proc.kill();
}
