/**
 * v2 polish check: no zoom on text fields (iOS zooms into anything under
 * 16px), a one-step theme switch, private images through signed links, and
 * "Clear all expense data" actually deleting it. Runs in WebKit (Safari's
 * engine) against the mocked Supabase API.
 *
 *   npm run smoke:fixes
 */
import { spawn } from "node:child_process";
import { webkit } from "playwright";
import { applyV2Migrations, buildDemoData, DEMO_NOW, DEMO_USER } from "./demo-data.ts";
import { demoSession, installMockSupabase, MOCK_AUTH_STORAGE_KEY, MOCK_SUPABASE_KEY, MOCK_SUPABASE_URL } from "./mock-supabase.ts";
import { rpcHandlers } from "./mock-rpc.ts";

const port = 5196;
const proc = spawn("node_modules/.bin/vite", ["--port", String(port), "--strictPort"], {
  env: { ...process.env, VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: MOCK_SUPABASE_KEY, VITE_SUPABASE_ANON_KEY: MOCK_SUPABASE_KEY },
  stdio: ["ignore", "pipe", "pipe"],
});
await new Promise((r) => proc.stdout.on("data", (b) => b.toString().includes("Local:") && r(null)));

// v1 stored full public URLs: one receipt and the avatar use that format.
const uid = DEMO_USER.id;
const publicUrl = (name: string) => `${MOCK_SUPABASE_URL}/storage/v1/object/public/expense-images/${uid}/${name}`;
const tables = applyV2Migrations(buildDemoData());
tables.profiles[0].settings_migrated_at = "2026-09-01T00:00:00Z";
tables.profiles[0].avatar_url = `${publicUrl("avatar.png")}?t=1`;
const withReceipt = tables.expenses.find((e) => String(e.date).startsWith("2026-09-19"))!;
withReceipt.image_url = publicUrl("old-receipt.jpg");
tables.storage = [
  { bucket: "expense-images", name: `${uid}/avatar.png` },
  { bucket: "expense-images", name: `${uid}/old-receipt.jpg` },
  { bucket: "expense-images", name: `${uid}/orphan.jpg` },
];

const browser = await webkit.launch();
const ctx = await browser.newContext({ baseURL: `http://localhost:${port}`, viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
await installMockSupabase(ctx, tables, rpcHandlers);
await ctx.addInitScript(([k, s]) => localStorage.setItem(k as string, JSON.stringify(s)), [MOCK_AUTH_STORAGE_KEY, demoSession()] as const);
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(DEMO_NOW));
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(m.text()));
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) process.exitCode = 1; };

/** Text fields on screen whose font is under 16px (iOS zooms into those). */
const smallFields = () => page.evaluate(() =>
  [...document.querySelectorAll("input, textarea, select")]
    .filter((el) => !["checkbox", "radio", "file", "hidden", "range", "color"].includes((el as HTMLInputElement).type))
    .filter((el) => (el as HTMLElement).getClientRects().length > 0)
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => el.getAttribute("aria-label") || el.id || el.getAttribute("placeholder") || el.tagName));
const loaded = (img: string) => page.locator(img).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);

try {
  await page.goto("/");
  await page.getByText("Recent Transactions").waitFor();

  // ── Private images: v1 URLs are shown through signed links ─────
  const avatar = page.locator('a[href="/profile"] img');
  await avatar.waitFor();
  ok((await avatar.getAttribute("src"))!.includes("/object/sign/expense-images/") && await loaded('a[href="/profile"] img'), "Home avatar (v1 URL) shows through a signed link");
  await page.getByTestId("transaction-card").filter({ hasText: String(withReceipt.title) }).first().click();
  const receipt = page.getByAltText("Expense receipt");
  await receipt.waitFor();
  ok((await receipt.getAttribute("src"))!.includes(`/object/sign/expense-images/${uid}/old-receipt.jpg`), "receipt (v1 URL) shows through a signed link");
  await page.keyboard.press("Escape");
  await page.goto("/");
  await page.getByText("Recent Transactions").waitFor();

  // ── No zoom: every field in the Add expense sheet is ≥16px ─────
  await page.getByTestId("add-expense").click();
  await page.locator("#title").waitFor();
  ok((await smallFields()).length === 0, `Add expense sheet: no field under 16px ${JSON.stringify(await smallFields())}`);

  // New receipts are stored as a path, not a public URL
  await page.locator("#title").fill("Receipt test");
  await page.locator("#amount").fill("8.20");
  await page.locator("#receipt-upload").setInputFiles({ name: "r.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") });
  await page.getByTestId("category-health").click().catch(() => page.locator("[data-testid^=category-]").first().click());
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await page.getByText("Expense added!").waitFor();
  const saved = tables.expenses.find((e) => e.title === "Receipt test");
  ok(saved && /^[0-9a-f-]+\/[0-9a-f-]+\.png$/.test(String(saved.image_url)) && String(saved.image_url).startsWith(uid), `new receipt stored as a path (${saved?.image_url})`);
  ok(tables.storage.some((f) => f.name === saved?.image_url), "…and uploaded to the user's folder");

  // Other screens with text fields
  await page.getByTestId("add-expense").click();
  await page.getByTestId("new-category").click();
  await page.getByRole("dialog").last().locator("input").first().waitFor();
  ok((await smallFields()).length === 0, `category editor: no field under 16px ${JSON.stringify(await smallFields())}`);
  await page.goto("/add");
  await page.getByTestId("draft-row").first().waitFor();
  ok((await smallFields()).length === 0, `Add expenses rows: no field under 16px ${JSON.stringify(await smallFields())}`);
  await page.getByRole("tab", { name: /Paste/ }).click();
  ok((await smallFields()).length === 0, "Add expenses paste box: no field under 16px");
  await page.goto("/profile");
  await page.getByText("Notifications").waitFor();
  ok((await smallFields()).length === 0, `Profile: no field under 16px ${JSON.stringify(await smallFields())}`);
  await page.setViewportSize({ width: 1280, height: 900 });
  ok(await page.locator("#cycle-day").evaluate((el) => getComputedStyle(el).fontSize) === "14px", "desktop keeps the compact 14px fields");
  await page.setViewportSize({ width: 390, height: 844 });

  // ── Theme: switches in one step, and nothing is left half-switched ─────
  const toggle = page.getByRole("button", { name: /Switch to (light|dark) theme/ });
  const cardBg = () => page.locator(".glass-card").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  const darkBg = await cardBg();
  await toggle.click();
  // With a view transition the new theme is applied on the next frame.
  await page.waitForFunction(() => document.documentElement.classList.contains("light"));
  const html = await page.evaluate(() => document.documentElement.className);
  ok(!html.includes("theme-switching"), "switches to light, no leftover class");
  const lightBgNow = await cardBg();
  await page.waitForTimeout(600);
  ok(lightBgNow === await cardBg() && lightBgNow !== darkBg, "colors change in one step (no per-element fade)");
  ok(await page.locator("button").first().evaluate((el) => getComputedStyle(el).transitionDuration !== "0s"), "hover transitions still work afterwards");
  await page.reload();
  await page.getByText("Notifications").waitFor();
  ok(await page.evaluate(() => document.documentElement.classList.contains("light")), "light theme kept after reload");
  await page.getByRole("button", { name: /Switch to dark theme/ }).click();
  ok(await page.waitForFunction(() => !document.documentElement.classList.contains("light"), null, { timeout: 2000 }).then(() => true, () => false), "switches back to dark");

  // ── Clear all expense data ─────
  const before = tables.expenses.length;
  await page.getByRole("button", { name: "Clear all expense data" }).click();
  await page.getByRole("alertdialog").waitFor();
  ok(await page.getByRole("alertdialog").getByText(/can’t be undone/).isVisible(), "asks for confirmation first");
  await page.getByRole("button", { name: "Cancel" }).click();
  ok(tables.expenses.length === before, "Cancel deletes nothing");
  await page.getByRole("button", { name: "Clear all expense data" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.getByText(`Deleted ${before} expenses`).waitFor();
  ok(tables.expenses.filter((e) => e.user_id === uid).length === 0, `all ${before} expenses deleted`);
  ok(tables.storage.length === 1 && tables.storage[0].name === `${uid}/avatar.png`, "receipts deleted (orphans too), avatar kept");
  ok(tables.custom_categories.length > 0 && tables.profiles.length === 1, "categories and profile kept");
  await page.goto("/");
  await page.getByText("Recent Transactions").waitFor();
  ok(await page.getByTestId("transaction-card").count() === 0, "Home is empty afterwards");

  ok(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors) : ""}`);
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await browser.close();
  proc.kill();
}
