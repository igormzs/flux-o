/**
 * Phase 2 end-to-end check: drives the /add screen against the mocked
 * Supabase API (typing rows, pasting a note, importing a bank CSV, duplicates,
 * validation, saving, Undo, rows kept across navigation).
 *
 *   npm run smoke:backfill
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { applyV2Migrations, buildDemoData, DEMO_NOW } from "./demo-data.ts";
import { demoSession, installMockSupabase, MOCK_AUTH_STORAGE_KEY, MOCK_SUPABASE_KEY, MOCK_SUPABASE_URL } from "./mock-supabase.ts";
import { rpcHandlers } from "./mock-rpc.ts";

const port = 5195;
const proc = spawn("node_modules/.bin/vite", ["--port", String(port), "--strictPort"], {
  env: { ...process.env, VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: MOCK_SUPABASE_KEY, VITE_SUPABASE_ANON_KEY: MOCK_SUPABASE_KEY },
  stdio: ["ignore", "pipe", "pipe"],
});
await new Promise((r) => proc.stdout.on("data", (b) => b.toString().includes("Local:") && r(null)));
const tables = applyV2Migrations(buildDemoData());
tables.profiles[0].settings_migrated_at = "2026-09-01T00:00:00Z";
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: `http://localhost:${port}`, viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
await installMockSupabase(ctx, tables, rpcHandlers);
await ctx.addInitScript(([k, s]) => localStorage.setItem(k as string, JSON.stringify(s)), [MOCK_AUTH_STORAGE_KEY, demoSession()] as const);
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(DEMO_NOW));
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) process.exitCode = 1; };
const rows = () => page.getByTestId("draft-row");
const row = (i: number) => rows().nth(i);
const startCount = tables.expenses.length;
const existing = tables.expenses.find((e) => String(e.date).startsWith("2026-09-19"))!;

try {
  // Entry point: the Add Expense sheet → "Add several"
  await page.goto("/");
  await page.getByText("Recent Transactions").waitFor();
  await page.getByTestId("add-expense").click();
  await page.getByTestId("add-several").click();
  await page.waitForURL("**/add");
  await rows().first().waitFor();
  ok(await rows().count() === 1, "opens /add with one empty row");

  // Typing: Enter moves on, date and category carry over, categories are guessed
  await row(0).getByLabel("Title, row 1").fill("Brunch");
  await row(0).getByLabel("Title, row 1").press("Enter");
  ok(await row(0).getByLabel("Amount, row 1").evaluate((el) => el === document.activeElement), "Enter in title → amount");
  ok((await row(0).getByLabel(/Category, row 1/).innerText()).includes("Food"), "Brunch → Food (keyword guess)");
  await row(0).getByLabel("Date, row 1").fill("2026-09-19");
  await row(0).getByLabel("Amount, row 1").fill("18,50");
  await row(0).getByLabel("Amount, row 1").press("Enter");
  ok(await rows().count() === 2 && await row(1).getByLabel("Title, row 2").evaluate((el) => el === document.activeElement), "Enter in amount → new row, focused");
  ok(await row(1).getByLabel("Date, row 2").inputValue() === "2026-09-19", "new row keeps the date");
  await row(1).getByLabel("Title, row 2").fill("Something odd");
  ok((await row(1).getByLabel(/Category, row 2/).innerText()).includes("Food"), "new row keeps the category");

  // Paste a weekend note, with one line that's already saved
  await page.getByTestId("mode-paste").click();
  const amount = Number(existing.amount).toFixed(2);
  await page.locator("#paste-box").fill(`Fri dinner with Ana 45\nSat groceries 62,30\nSat Uber home 12.40\n19/09 ${existing.title} ${amount}\nSun coffee € 3.50`);
  await page.getByTestId("read-text").click();
  await page.getByTestId("read-summary").waitFor();
  const summary = await page.getByTestId("read-summary").innerText();
  ok(summary.includes("Read 5 expenses") && summary.includes("1 possible duplicate"), `summary: ${summary.split("\n")[0]}`);
  ok(await rows().count() === 7, "typed rows kept, 5 read rows added");
  ok(!(await row(5).getByRole("checkbox").isChecked()) && (await row(5).innerText()).includes("Looks like"), "the saved one is unticked and explained");
  ok((await row(3).getByLabel(/Category, row 4/).innerText()).includes("Grocery"), "groceries → Grocery");
  ok((await row(4).getByLabel(/Category, row 5/).innerText()).includes("Travel"), "Uber → Travel");
  ok(await row(6).getByLabel("Currency, row 7").inputValue() === "EUR", "€ line keeps its currency");

  // Validation: the row without an amount blocks saving and says why
  await page.getByTestId("save-all").click();
  await page.waitForTimeout(300);
  ok((await row(1).innerText()).includes("Add an amount"), "missing amount is shown on the row");
  ok(tables.expenses.length === startCount && page.url().endsWith("/add"), "nothing saved while a row is incomplete");
  await row(1).getByLabel("Amount, row 2").fill("7");

  // A bank CSV file: income skipped
  await page.getByTestId("mode-paste").click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Data;Descrição;Montante\n18/09/2026;NETFLIX.COM;-12,99\n18/09/2026;SALARIO;2.100,00\n17/09/2026;Continente Lisboa;-38,20"),
  });
  await page.getByText("1 incoming payment skipped").waitFor();
  ok(await rows().count() === 9, "CSV: 2 expenses added, income skipped");
  ok((await row(7).getByLabel(/Category, row 8/).innerText()).includes("Subs"), "Netflix → Subs");

  // Rows survive leaving the page
  await page.goto("/insights");
  await page.goBack();
  await rows().first().waitFor();
  ok(await rows().count() === 9, "unsaved rows kept after navigating away");

  const saveText = await page.getByTestId("save-all").innerText();
  ok(saveText.includes("Save 8 expenses") && saveText.includes("€3.50"), `save button: ${saveText.replace(/\n/g, " · ")}`);
  await page.getByTestId("save-all").click();
  await page.waitForURL(/\/$/);
  ok(tables.expenses.length === startCount + 8, "8 saved in one go");
  const brunch = tables.expenses.find((e) => e.title === "Brunch")!;
  ok(brunch && brunch.category === "food" && Number(brunch.amount) === 18.5 && String(brunch.date) === "2026-09-19T12:00:00.000Z", "saved with the right day (noon), amount and category");
  const shown = await page.getByText("Brunch", { exact: true }).first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  ok(shown, "new expenses show on Home straight away");

  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(700);
  ok(tables.expenses.length === startCount, "Undo removes all 8");

  ok(errors.length === 0, `no console errors ${errors.slice(0, 3).join(" | ")}`);
} catch (e) {
  console.error("FAILED:", (e as Error).message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await browser.close();
  proc.kill();
}
