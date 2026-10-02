/**
 * The All expenses screen against the mocked Supabase API: reaching it from
 * Home, month by month, per-day groups, search, and editing an expense that
 * Home's recent list no longer shows.
 *
 *   npm run smoke:expenses
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
tables.recurring_expenses = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: `http://localhost:${port}`, viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
await installMockSupabase(ctx, tables, rpcHandlers);
await ctx.addInitScript(([k, s]) => localStorage.setItem(k as string, JSON.stringify(s)), [MOCK_AUTH_STORAGE_KEY, demoSession()] as const);
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(DEMO_NOW)); // Sunday 20 Sep 2026
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) process.exitCode = 1; };
const settle = () => page.waitForTimeout(400);
const inMonth = (m: string) => tables.expenses.filter((e) => String(e.date).startsWith(m));
const summary = () => page.getByTestId("expenses-summary").innerText();
const shot = process.env.SHOTS;

try {
  await page.goto("/");
  await page.getByText("Recent Transactions").waitFor();
  await page.getByTestId("see-all-expenses").click();
  await page.waitForURL("**/expenses");
  await page.getByTestId("transaction-card").first().waitFor();
  ok(await page.getByTestId("expenses-month").innerText() === "September 2026", "opens on this month");
  ok((await summary()).endsWith(`${inMonth("2026-09").length} expenses`), `lists every September expense (${await summary()})`);
  ok(await page.getByTestId("transaction-card").count() === inMonth("2026-09").length, "…one card each, not just the recent 10");
  ok(await page.getByText("in other currency").isVisible(), "the EUR train ticket is listed apart from the USD total");
  ok(await page.getByRole("button", { name: "Next month" }).isDisabled(), "can't go past this month");
  const days = new Set(inMonth("2026-09").map((e) => String(e.date).slice(0, 10))).size;
  ok(await page.getByTestId("expenses-day").count() === days, `grouped into ${days} days`);
  if (shot) { await page.waitForTimeout(1500); await page.screenshot({ path: `${shot}/expenses-sep.png` }); }

  await page.getByRole("button", { name: "Previous month" }).click();
  await page.waitForURL("**/expenses?month=2026-08");
  await page.getByText("Payday brunch").waitFor();
  ok((await summary()).endsWith(`${inMonth("2026-08").length} expenses`), `August: ${await summary()}`);

  await page.getByRole("searchbox").fill("payday");
  await settle();
  ok(await page.getByTestId("transaction-card").count() === 1 && (await summary()).startsWith("$48.60 · 1 expense"), "search narrows the month to one match");
  await page.getByRole("searchbox").fill("nothing like this");
  ok(await page.getByText("Nothing matching").isVisible(), "says when nothing matches");
  await page.getByRole("searchbox").fill("payday");

  // Edit an expense from last month
  await page.getByTestId("transaction-card").first().click();
  await page.getByTitle("Edit expense").click();
  await page.locator("#title").fill("Payday brunch with Sam");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.getByText("Payday brunch with Sam").waitFor();
  ok(tables.expenses.some((e) => e.title === "Payday brunch with Sam"), "edit saved");
  ok(await page.getByTestId("expenses-month").innerText() === "August 2026", "…and stays on August");

  await page.reload();
  await page.getByTestId("transaction-card").first().waitFor();
  ok(await page.getByTestId("expenses-month").innerText() === "August 2026", "the month survives a reload (it's in the URL)");
  await page.goto("/expenses?month=2026-07");
  await page.getByText("Flights to Lisbon").waitFor();
  ok(true, "older months open from the URL");
  await page.goto("/expenses?month=2025-01");
  ok(await page.getByText("No expenses in January 2025").isVisible(), "empty month says so");
  if (shot) {
    await page.goto("/expenses?month=2026-08");
    await page.getByTestId("transaction-card").first().waitFor();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${shot}/expenses-aug.png` });
  }

  ok(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  proc.kill();
}
