/**
 * Recurring expenses end to end against the mocked Supabase API: setting
 * bills up, confirming from Home with an edited amount, Undo, Confirm all,
 * "still to come this cycle", skipping, next month's suggested amount,
 * pausing and deleting.
 *
 *   npm run smoke:recurring
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { applyV2Migrations, buildDemoData, DEMO_NOW } from "./demo-data.ts";
import { demoSession, installMockSupabase, MOCK_AUTH_STORAGE_KEY, MOCK_SUPABASE_KEY, MOCK_SUPABASE_URL } from "./mock-supabase.ts";
import { rpcHandlers } from "./mock-rpc.ts";

const port = 5194;
const proc = spawn("node_modules/.bin/vite", ["--port", String(port), "--strictPort"], {
  env: { ...process.env, VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: MOCK_SUPABASE_KEY, VITE_SUPABASE_ANON_KEY: MOCK_SUPABASE_KEY },
  stdio: ["ignore", "pipe", "pipe"],
});
await new Promise((r) => proc.stdout.on("data", (b) => b.toString().includes("Local:") && r(null)));
const tables = applyV2Migrations(buildDemoData());
tables.profiles[0].settings_migrated_at = "2026-09-01T00:00:00Z";
tables.recurring_expenses = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: `http://localhost:${port}`, viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
await installMockSupabase(ctx, tables, rpcHandlers);
await ctx.addInitScript(([k, s]) => localStorage.setItem(k as string, JSON.stringify(s)), [MOCK_AUTH_STORAGE_KEY, demoSession()] as const);
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(DEMO_NOW)); // Sunday 20 Sep 2026; pay cycle 25 Aug – 24 Sep
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) process.exitCode = 1; };
const confirmed = () => tables.expenses.filter((e) => e.recurring_id);
const card = () => page.getByTestId("bills-due-card");
const settle = () => page.waitForTimeout(400);
const dismissToasts = () => page.evaluate(() => document.querySelectorAll("[data-sonner-toast]").forEach((t) => { (t as HTMLElement).style.display = "none"; }));

async function addBill(title: string, amount: string, day: string, category: string) {
  await page.getByTestId("create-bill").click();
  const sheet = page.locator("[aria-labelledby=bill-editor-title]");
  await sheet.locator("#bill-title").fill(title);
  await sheet.locator("#bill-amount").fill(amount);
  await sheet.locator("#bill-day").fill(day);
  await sheet.getByRole("button", { name: /^Category:/ }).click();
  await page.getByRole("radio", { name: category, exact: true }).click();
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await sheet.waitFor({ state: "hidden" });
  await dismissToasts();
}

try {
  await page.goto("/");
  await page.getByText("Recent Transactions").waitFor();
  ok(await card().count() === 0, "Home shows no recurring card before any are set up");

  // Setting up, from Profile
  await page.goto("/profile");
  await page.getByTestId("manage-recurring").click();
  await page.waitForURL("**/recurring");
  await page.getByText("No recurring expenses yet").waitFor();
  await page.getByTestId("create-bill").click();
  const small = await page.locator("[aria-labelledby=bill-editor-title]").locator("input, select").evaluateAll((els) => els.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length);
  ok(small === 0, "editor fields are 16px on phones (no zoom)");
  await page.locator("[aria-labelledby=bill-editor-title]").getByRole("button", { name: "Add", exact: true }).click();
  ok(await page.getByText("Add a name · Add the usual amount · Pick a category").isVisible(), "says what's missing, saves nothing");
  ok(tables.recurring_expenses.length === 0, "…nothing saved");
  await page.getByRole("button", { name: "Close" }).click();

  await addBill("Rent", "800", "1", "Rent");
  await addBill("Water", "30", "18", "Utilities");
  await addBill("Internet", "40", "28", "Utilities");
  ok(tables.recurring_expenses.length === 3 && tables.recurring_expenses.every((b) => b.starts_on === "2026-09-01"), "3 saved, counting from the start of this month");
  ok((await page.getByTestId("bills-summary").innerText()).includes("$870.00 a month across 3 expenses"), "summary: $870.00 a month across 3 expenses");
  const rows = page.getByTestId("bill-row");
  ok(await rows.nth(0).getByText("Due Sep 1", { exact: false }).isVisible() && await rows.nth(1).getByText("Due Sep 18").isVisible(), "Rent and Water: already due this month, ready to confirm");
  ok(await rows.nth(2).getByText("Due Sep 28").isVisible(), "Internet: upcoming");

  // Home: confirm with the real amount
  await page.goto("/");
  await card().waitFor();
  ok(await card().getByText("2 recurring expenses to confirm").isVisible(), "Home: 2 recurring expenses to confirm");
  ok((await page.getByTestId("bills-to-come").innerText()).includes("$830.00"), "…and $830.00 still to come this cycle (Internet is next cycle)");
  ok(await page.getByLabel("Amount for Water").inputValue() === "30.00", "amount pre-filled with the usual one");
  const before = tables.expenses.length;
  await page.getByLabel("Amount for Water").fill("31,20");
  await page.getByRole("button", { name: "Confirm Water" }).click();
  await page.getByText("Water added: $31.20").waitFor();
  const water = confirmed()[0];
  ok(confirmed().length === 1 && water.amount === 31.2 && water.category === "utilities" && water.recurring_period === "2026-09" && String(water.date).startsWith("2026-09-18T12:00"),
    `confirming creates the expense: $31.20, Utilities, dated the due day at noon (${water?.date})`);
  await card().getByText("1 recurring expense to confirm").waitFor();
  ok(await page.getByTestId("transaction-card").filter({ hasText: "Water" }).count() > 0, "…and it shows in Recent Transactions");

  // Undo
  await page.getByRole("button", { name: "Undo" }).click();
  await card().getByText("2 recurring expenses to confirm").waitFor();
  ok(confirmed().length === 0 && tables.expenses.length === before, "Undo removes it and it's due again");
  await dismissToasts();

  // Confirm all (the typed amount is kept)
  await page.getByLabel("Amount for Water").fill("31,20");
  await page.getByRole("button", { name: "Confirm all" }).click();
  await page.getByText("2 recurring expenses added").waitFor();
  ok(confirmed().length === 2 && confirmed().some((e) => e.title === "Rent" && e.amount === 800 && String(e.date).startsWith("2026-09-01T12:00")) && confirmed().some((e) => e.title === "Water" && e.amount === 31.2),
    "Confirm all adds both in one go, with the edited amount");
  await card().waitFor({ state: "hidden" });
  ok(true, "nothing left to confirm or to come this cycle: the card goes away");
  await dismissToasts();

  // The Recurring screen: status, skip, undo skip
  await page.goto("/recurring");
  await rows.first().waitFor();
  ok(await rows.nth(0).getByText("September: confirmed, $800.00").isVisible() && await rows.nth(1).getByText("September: confirmed, $31.20").isVisible(), "screen shows September confirmed with the amounts paid");
  await page.getByRole("button", { name: "Skip Internet this time" }).click();
  await rows.nth(2).getByText("September: skipped").waitFor();
  ok(JSON.stringify(tables.recurring_expenses.find((b) => b.title === "Internet")!.skipped) === '["2026-09"]', "Skip marks this month only");
  await rows.nth(2).getByRole("button", { name: "Undo" }).click();
  await rows.nth(2).getByText("Due Sep 28").waitFor();
  ok(true, "Undo brings it back");
  await dismissToasts();

  // Confirm early: dated today, counted for this month
  await page.getByRole("button", { name: "Confirm Internet" }).click();
  await rows.nth(2).getByText("September: confirmed, $40.00").waitFor();
  const internet = confirmed().find((e) => e.title === "Internet")!;
  ok(String(internet.date).startsWith("2026-09-20T12:00") && internet.recurring_period === "2026-09", "confirming early dates it today, for this month");
  await dismissToasts();

  // Next month: what was paid last time is suggested
  await page.clock.setFixedTime(new Date("2026-10-19T10:00:00Z"));
  await page.goto("/");
  await card().waitFor();
  ok(await card().getByText("2 recurring expenses to confirm").isVisible(), "19 Oct: Rent and Water are due again");
  ok(await page.getByLabel("Amount for Water").inputValue() === "31.20", "Water suggests $31.20, what was paid last time");
  const toCome = await page.getByTestId("bills-to-come").innerText();
  ok(toCome.includes("$831.20"), `still to come this cycle (25 Sep – 24 Oct): $831.20, Rent + Water; Internet on the 28th is next cycle (${toCome.trim()})`);

  // Pause and delete
  await page.goto("/recurring");
  await page.getByRole("button", { name: "Edit Rent" }).click();
  await page.locator("[aria-labelledby=bill-editor-title]").getByRole("switch", { name: "Active" }).click();
  await page.locator("[aria-labelledby=bill-editor-title]").getByRole("button", { name: "Save Changes" }).click();
  await rows.nth(0).getByText("Paused").waitFor();
  ok(await rows.nth(0).getByTestId("bill-occurrence").count() === 0, "a paused one is never due");
  await dismissToasts();
  await page.getByRole("button", { name: "Edit Internet" }).click();
  await page.locator("[aria-labelledby=bill-editor-title]").getByRole("button", { name: "Delete" }).click();
  ok(tables.recurring_expenses.length === 3, "Delete asks for a second tap");
  await page.locator("[aria-labelledby=bill-editor-title]").getByRole("button", { name: "Tap again to delete" }).click();
  await page.locator("[aria-labelledby=bill-editor-title]").waitFor({ state: "hidden" });
  await settle();
  ok(tables.recurring_expenses.length === 2 && tables.expenses.some((e) => e.title === "Internet"), "deleting it keeps its past expenses");
  await page.goto("/");
  await card().waitFor();
  ok(await card().getByText("1 recurring expense to confirm").isVisible(), "Home now asks only for Water");

  ok(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors) : ""}`);
} catch (err) {
  console.error(err, errors.slice(0, 3));
  process.exitCode = 1;
} finally {
  await browser.close();
  proc.kill();
}
