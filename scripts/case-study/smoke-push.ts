/**
 * Push notifications, end to end in real Google Chrome: turning them on for
 * the device, the weekly report setting, "Send a test" delivered through
 * Google's push service with our own encryption and VAPID signature, turning
 * them off, and the iPhone "add to Home Screen first" hint.
 *
 *   npm run smoke:push   (needs Google Chrome and an internet connection)
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { applyV2Migrations, buildDemoData, DEMO_NOW } from "./demo-data.ts";
import { demoSession, installMockSupabase, MOCK_AUTH_STORAGE_KEY, MOCK_SUPABASE_KEY, MOCK_SUPABASE_URL } from "./mock-supabase.ts";
import { rpcHandlers } from "./mock-rpc.ts";
import { b64urlEncode, sendPush, type VapidKeys } from "../../supabase/functions/_shared/webpush.ts";
import { reportWeek, weeklyMessage, weekTotals } from "../../supabase/functions/_shared/weekly.ts";

// A key pair for this run only.
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
const vapid: VapidKeys = {
  publicKey: b64urlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
  privateKey: (await crypto.subtle.exportKey("jwk", pair.privateKey)).d!,
  subject: "https://flux-o.vercel.app",
};

const port = 5199;
const proc = spawn("node_modules/.bin/vite", ["--port", String(port), "--strictPort"], {
  env: { ...process.env, VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: MOCK_SUPABASE_KEY, VITE_SUPABASE_ANON_KEY: MOCK_SUPABASE_KEY, VITE_VAPID_PUBLIC_KEY: vapid.publicKey },
  stdio: ["ignore", "pipe", "pipe"],
});
await new Promise((r) => proc.stdout.on("data", (b) => b.toString().includes("Local:") && r(null)));

const tables = applyV2Migrations(buildDemoData());
const profile = tables.profiles[0];
profile.settings_migrated_at = "2026-09-01T00:00:00Z";
profile.notifications = { overBudget: true, weeklyReport: false, dailyReminder: false };

// The notify function's "test" request, as the Edge Function does it, but sending for real.
const pushStatuses: number[] = [];
const notify = async (body: Record<string, unknown>) => {
  if (body.type !== "test") throw new Error("unexpected request");
  const tz = String(profile.timezone ?? "UTC");
  const week = reportWeek(new Date(DEMO_NOW), tz);
  const currency = String(profile.currency ?? "EUR");
  const msg = weeklyMessage(weekTotals(tables.expenses as never, week, currency, tables.custom_categories as never), currency);
  let sent = 0;
  for (const sub of tables.push_subscriptions ?? []) {
    const r = await sendPush(sub as never, { title: `Preview · ${msg.title}`, body: msg.body, url: `/insights?scope=week&at=${week.key}`, tag: "test" }, vapid);
    pushStatuses.push(r.status);
    if (r.status >= 200 && r.status < 300) sent++;
  }
  return { sent, removed: 0, failed: 0, devices: (tables.push_subscriptions ?? []).length };
};

// Chrome only subscribes to push when the profile allows notifications (a
// granted permission isn't enough), and needs background networking for
// Google's push service. Headless works with both.
const profileDir = mkdtempSync(join(tmpdir(), "flux-o-push-"));
mkdirSync(join(profileDir, "Default"));
writeFileSync(join(profileDir, "Default", "Preferences"), JSON.stringify({ profile: { default_content_setting_values: { notifications: 1 } } }));
const baseURL = `http://localhost:${port}`;
const ctx = await chromium.launchPersistentContext(profileDir, {
  channel: "chrome", ignoreDefaultArgs: ["--disable-background-networking"],
  baseURL, viewport: { width: 390, height: 844 }, timezoneId: "Europe/Lisbon",
});
const browser = await chromium.launch();
await installMockSupabase(ctx, tables, rpcHandlers, { notify });
await ctx.addInitScript(([k, s]) => localStorage.setItem(k as string, JSON.stringify(s)), [MOCK_AUTH_STORAGE_KEY, demoSession()] as const);
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) process.exitCode = 1; };
const status = () => page.getByTestId("device-status").innerText();
const weekly = () => page.getByRole("switch", { name: "Weekly report" });

try {
  await page.goto("/profile");
  const card = page.getByTestId("notifications-card");
  await card.waitFor();
  await page.waitForFunction(() => !document.querySelector("[data-testid=device-status]")?.textContent?.includes("Checking"));
  ok((await status()).startsWith("Off"), "starts off on this device");
  ok(await card.getByRole("switch", { name: "Over budget alert" }).isDisabled() && await card.getByText("Coming soon").count() === 2, "over budget and daily reminder marked Coming soon");
  ok(await card.getByText("Mondays at 9:00").isVisible(), "weekly report says Monday, not Sunday");

  // Turn on: permission, subscription with Google's push service, saved with the time zone
  await page.getByRole("button", { name: "Turn on for this device" }).click();
  await page.waitForFunction(() => document.querySelector("[data-testid=device-status]")?.textContent?.startsWith("On"), null, { timeout: 20000 });
  const sub = tables.push_subscriptions?.[0];
  ok(tables.push_subscriptions?.length === 1 && String(sub?.endpoint).startsWith("https://fcm.googleapis.com/"), `device saved with a real push endpoint (${String(sub?.endpoint).slice(0, 40)}…)`);
  ok(sub?.p256dh && sub?.auth, "…with its encryption keys");
  ok(profile.timezone === "Europe/Lisbon", "time zone saved for the Monday 9:00 timing");
  ok((profile.notifications as Record<string, boolean>).weeklyReport === true && await weekly().getAttribute("aria-checked") === "true", "turning on the device switches the weekly report on");

  // Send a test: real encryption + VAPID through Google, shown by the service worker
  await page.getByRole("button", { name: "Send a test" }).click();
  await page.getByText(/^Sent/).waitFor({ timeout: 20000 });
  ok(pushStatuses[0] === 201, `Google's push service accepted it (HTTP ${pushStatuses[0]})`);
  const shown = await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    const list = await reg.getNotifications();
    return list.length ? { title: list[0].title, body: list[0].body, url: list[0].data?.url } : null;
  }, null, { timeout: 30000, polling: 500 }).then((h) => h.jsonValue()).catch(() => null);
  ok(shown?.title.startsWith("Preview · Your week: "), `the notification arrived and was shown: “${shown?.title}”`);
  ok(shown?.body && shown.url?.startsWith("/insights?scope=week&at="), `…with the summary and a link to that week: “${shown?.body}”`);

  // The weekly switch saves straight away and keeps unsaved edits elsewhere
  await page.locator("#cycle-day").fill("7");
  await weekly().click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Weekly report"]')?.getAttribute("aria-checked") === "false");
  await page.waitForTimeout(300);
  ok((profile.notifications as Record<string, boolean>).weeklyReport === false, "weekly report off is saved without pressing Save");
  ok(await page.locator("#cycle-day").inputValue() === "7" && profile.billing_cycle_day !== 7, "…and the unsaved cycle day edit is kept, not saved");
  await weekly().click();
  await page.waitForTimeout(300);

  // Reload: still on
  await page.reload();
  await page.waitForFunction(() => document.querySelector("[data-testid=device-status]")?.textContent?.startsWith("On"), null, { timeout: 10000 });
  ok(true, "still on after a reload");

  // Turn off
  await page.getByRole("button", { name: "Turn off here" }).click();
  await page.waitForFunction(() => document.querySelector("[data-testid=device-status]")?.textContent?.startsWith("Off"));
  ok((tables.push_subscriptions ?? []).length === 0, "turning off removes the device");

  ok(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors) : ""}`);

  // iPhone Safari, not added to the Home Screen: no push API, so show how to add it
  const iphone = await browser.newContext({
    baseURL, viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  await installMockSupabase(iphone, tables, rpcHandlers, { notify });
  await iphone.addInitScript(([k, s]) => { localStorage.setItem(k as string, JSON.stringify(s)); delete (window as { PushManager?: unknown }).PushManager; }, [MOCK_AUTH_STORAGE_KEY, demoSession()] as const);
  const p2 = await iphone.newPage();
  await p2.goto("/profile");
  await p2.getByTestId("device-status").filter({ hasText: "Home Screen" }).waitFor();
  ok(true, "iPhone in Safari: explains adding Flux-o to the Home Screen first");
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
  rmSync(profileDir, { recursive: true, force: true });
  proc.kill();
}
