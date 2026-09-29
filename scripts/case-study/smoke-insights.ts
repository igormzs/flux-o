/**
 * Phase 1b end-to-end check: drives Insights against the mocked Supabase API
 * (scopes, period chips, comparisons, moved paydays, weekend rule) and checks
 * that Home agrees with Insights about when the cycle starts.
 *
 *   npm run smoke:insights
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { applyV2Migrations, buildDemoData, DEMO_NOW } from "./demo-data.ts";
import { demoSession, installMockSupabase, MOCK_AUTH_STORAGE_KEY, MOCK_SUPABASE_KEY, MOCK_SUPABASE_URL } from "./mock-supabase.ts";
import { rpcHandlers } from "./mock-rpc.ts";

const port = 5196;
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
const header = () => page.getByTestId("period-header").innerText();
const pulse = () => page.getByTestId("pulse").innerText();
const profile = () => tables.profiles[0];
/** Main-currency total of the demo expenses in [from, to) (UTC dates). */
const total = (from: string, to: string) => tables.expenses
  .filter((e) => (e.currency ?? "USD") === "USD" && String(e.date) >= from && String(e.date) < to)
  .reduce((s, e) => s + Number(e.amount), 0);
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

try {
  await page.goto("/insights");
  await page.getByTestId("history-chart").waitFor();
  let h = await header();
  ok(h.includes("September cycle") && h.includes("Aug 25 – Sep 24") && h.includes("Day 27 of 31"), `default: current cycle in progress (${h.replace(/\n/g, " | ")})`);
  ok((await pulse()).includes("at the same point"), "in-progress cycle compared at the same point");
  ok(await page.getByText(money(total("2026-08-25", "2026-09-25"))).count() > 0, "cycle total matches the data");

  await page.getByTestId("scope-month").click();
  await page.waitForTimeout(400);
  ok(page.url().includes("scope=month") && (await header()).includes("September 2026"), "Month tab → current month, in the URL");
  await page.getByRole("radio", { name: "Aug", exact: true }).click();
  await page.waitForTimeout(400);
  h = await header();
  ok(h.includes("August 2026") && !h.includes("Day "), "chip → a finished month");
  ok((await pulse()).includes("vs last month") && !(await pulse()).includes("same point"), "finished month compared in full");
  ok(await page.getByText(money(total("2026-08-01", "2026-09-01"))).count() > 0, "month total matches the data");
  await page.getByTestId("baseline-average").click();
  ok((await pulse()).includes("-month average"), "Average baseline");
  await page.goBack();
  await page.waitForTimeout(300);
  ok((await header()).includes("September 2026"), "Back returns to the previous period");

  await page.getByTestId("scope-week").click();
  await page.waitForTimeout(400);
  ok(await page.getByText("By day").count() === 1 && (await header()).includes("Week of Sep 14"), "Week tab → week of Sep 14, split by day");
  await page.getByTestId("scope-year").click();
  await page.waitForTimeout(400);
  ok(await page.getByText("By month").count() === 1 && (await header()).includes("2026"), "Year tab → split by month");
  await page.getByTestId("scope-custom").click();
  await page.waitForTimeout(400);
  ok((await header()).includes("Aug 22 – Sep 20"), "Custom → last 30 days");

  // One-off payday move
  await page.goto("/insights?scope=cycle");
  await page.getByTestId("payday-moved").click();
  await page.locator("#payday-date").fill("2026-08-21");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText(/Started .* payday moved/).waitFor();
  ok(JSON.stringify(profile().cycle_start_overrides) === '{"2026-08":"2026-08-21"}', `override saved (${JSON.stringify(profile().cycle_start_overrides)})`);
  ok((await header()).includes("Aug 21 – Sep 24"), "cycle now starts Aug 21");
  const moved = money(total("2026-08-21", "2026-09-25"));
  ok(await page.getByText(moved).count() > 0, `Insights total includes Aug 21–24 (${moved})`);
  await page.goto("/");
  await page.getByText("Recent Transactions").waitFor();
  ok(await page.getByText(moved).count() > 0, "Home total agrees with Insights");
  await page.goto("/insights?scope=cycle&at=2026-08-01");
  await page.getByTestId("history-chart").waitFor();
  ok((await header()).includes("Jul 25 – Aug 20"), "previous cycle ends where the moved one starts");

  // Out-of-range date is refused
  await page.goto("/insights?scope=cycle");
  await page.getByTestId("payday-moved").click();
  await page.locator("#payday-date").fill("2026-09-10");
  ok(await page.getByRole("button", { name: "Save" }).isDisabled(), "more than 10 days away can't be saved");
  await page.getByRole("button", { name: "Usual day" }).click();
  await page.waitForTimeout(500);
  ok(JSON.stringify(profile().cycle_start_overrides) === "{}", "reset to the usual day");

  // Weekend rule, set in Profile: 25 Oct 2026 is a Sunday
  await page.goto("/profile");
  await page.getByRole("radio", { name: "Friday before" }).click();
  await page.getByRole("button", { name: "Save Settings" }).click();
  await page.waitForTimeout(500);
  ok(profile().payday_weekend_rule === "before", "weekend rule saved");
  await page.goto("/insights?scope=cycle&at=2026-10-24");
  await page.getByTestId("history-chart").waitFor();
  h = await header();
  ok(h.includes("Oct 23 – Nov 24") && h.includes("was a weekend"), `Sunday payday starts Friday (${h.replace(/\n/g, " | ")})`);

  ok(errors.length === 0, `no console errors ${errors.slice(0, 3).join(" | ")}`);
} catch (e) {
  console.error("FAILED:", (e as Error).message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await browser.close();
  proc.kill();
}
