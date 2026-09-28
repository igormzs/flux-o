/**
 * Captures the case-study screenshots for one version of the app.
 *
 *   node scripts/case-study/screenshots.ts --out docs/case-study/screenshots/v2/phase-0
 *   node scripts/case-study/screenshots.ts --app-dir ../flux-o-v1 --out docs/case-study/screenshots/v1
 *
 * Starts a Vite dev server for `--app-dir` pointed at the mock Supabase API,
 * freezes the clock at DEMO_NOW, and captures every screen at mobile and
 * desktop size in light and dark themes. File names are the same for every
 * version (`<screen>.<viewport>.<theme>.png`), so v1 and v2 images pair up.
 *
 * Flags: --app-dir <path>  --out <dir>  --only <screen,screen>  --port <n>
 *        --schema v1|v2   (default v2: demo data as it looks after the v2 migrations)
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { applyV2Migrations, buildDemoData, DEMO_LOCAL_SETTINGS, DEMO_NOW } from "./demo-data.ts";
import {
  demoSession,
  installMockSupabase,
  MOCK_AUTH_STORAGE_KEY,
  MOCK_SUPABASE_KEY,
  MOCK_SUPABASE_URL,
} from "./mock-supabase.ts";
import { rpcHandlers } from "./mock-rpc.ts";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);

const appDir = path.resolve(args.get("app-dir") ?? ".");
const outDir = path.resolve(args.get("out") ?? "docs/case-study/screenshots/current");
const port = Number(args.get("port") ?? 5199);
const only = args.get("only")?.split(",");
const schema = args.get("schema") ?? "v2";
const demoData = () => (schema === "v1" ? buildDemoData() : applyV2Migrations(buildDemoData()));
const baseURL = `http://localhost:${port}`;

const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
} as const;
const THEMES = ["dark", "light"] as const;

/** Clicks the first selector that exists, so one script works across versions. */
async function clickFirst(page: Page, selectors: string[]) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      await el.click();
      return;
    }
  }
  throw new Error(`none of these selectors matched: ${selectors.join(" | ")}`);
}

const settle = (page: Page, ms = 1200) => page.waitForTimeout(ms);

async function openAddSheet(page: Page) {
  await page.goto("/");
  await page.getByText("Recent Transactions").waitFor();
  await settle(page, 600);
  await clickFirst(page, ['[data-testid="add-expense"]', "button.fixed.bottom-24"]);
  await settle(page, 700);
}

interface Screen {
  name: string;
  /** Also capture the whole scrollable page, not just the first viewport. */
  full?: boolean;
  run: (page: Page) => Promise<void>;
}

const SCREENS: Screen[] = [
  {
    name: "home",
    full: true,
    run: async (page) => {
      await page.goto("/");
      await page.getByText("Recent Transactions").waitFor();
    },
  },
  { name: "add-expense-empty", run: openAddSheet },
  {
    name: "add-expense-filled",
    run: async (page) => {
      await openAddSheet(page);
      await page.locator("#title").fill("Brunch with friends");
      await page.locator("#amount").fill("42.50");
      await clickFirst(page, ['[data-testid="category-food"]', '.grid-cols-4 button:has-text("Food")']);
      await settle(page, 400);
    },
  },
  {
    name: "new-category",
    run: async (page) => {
      await openAddSheet(page);
      await clickFirst(page, ['[data-testid="new-category"]', 'button:has-text("New")']);
      await settle(page, 500);
      await page.locator("#new-cat-label").fill("Pets");
      // Bring the icon/color pickers into view, not just the name field.
      await page.locator('button:has-text("Create")').last().scrollIntoViewIfNeeded();
      await settle(page, 400);
    },
  },
  {
    name: "expense-detail",
    run: async (page) => {
      await page.goto("/");
      await page.getByText("Recent Transactions").waitFor();
      await settle(page, 600);
      await clickFirst(page, ['[data-testid="transaction-card"]', 'div:has(> h3:has-text("Recent Transactions")) button']);
      await settle(page, 700);
    },
  },
  {
    name: "insights",
    full: true,
    run: async (page) => {
      await page.goto("/insights");
      await page.getByText("Category breakdown", { exact: false }).waitFor();
    },
  },
  {
    name: "profile",
    full: true,
    run: async (page) => {
      await page.goto("/profile");
      await settle(page, 800);
    },
  },
];

async function startDevServer() {
  const vite = path.join(appDir, "node_modules/.bin/vite");
  const proc = spawn(vite, ["--port", String(port), "--strictPort", "--host", "localhost"], {
    cwd: appDir,
    env: { ...process.env, VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_SUPABASE_KEY, VITE_SUPABASE_PUBLISHABLE_KEY: MOCK_SUPABASE_KEY },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("vite did not start in 30s")), 30_000);
    proc.stdout.on("data", (buf: Buffer) => {
      if (buf.toString().includes("Local:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.on("exit", (code) => reject(new Error(`vite exited with ${code}`)));
  });
  return proc;
}

/** The app scrolls inside an inner container, so grow the viewport to fit it. */
async function captureFull(page: Page, file: string, viewport: { width: number; height: number }) {
  const height = await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll<HTMLElement>("*")].filter(
      (el) => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY),
    );
    return Math.max(document.documentElement.scrollHeight, ...scrollers.map((el) => el.scrollHeight));
  });
  await page.setViewportSize({ width: viewport.width, height: Math.min(height + 120, 6000) });
  await settle(page, 500);
  await page.screenshot({ path: file });
  await page.setViewportSize(viewport);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const server = await startDevServer();
  const failures: string[] = [];
  const browser = await chromium.launch().catch((err) => {
    server.kill();
    throw err;
  });
  try {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      for (const theme of THEMES) {
        for (const screen of SCREENS) {
          if (only && !only.includes(screen.name)) continue;
          const context = await browser.newContext({
            baseURL,
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: vp.deviceScaleFactor,
            isMobile: vp.isMobile,
            hasTouch: vp.hasTouch,
            timezoneId: "UTC",
            locale: "en-US",
            colorScheme: theme,
          });
          await installMockSupabase(context, demoData(), rpcHandlers);
          await context.addInitScript(
            ([key, session, settings, themeName]) => {
              localStorage.setItem(key as string, JSON.stringify(session));
              localStorage.setItem("fluxo_settings", JSON.stringify(settings));
              localStorage.setItem("theme", themeName as string);
              // Init scripts run before <html> exists; tag it as soon as it's created.
              // (v1 can't restore a saved light theme on its own; see visual-changes.md.)
              const apply = () => {
                const root = document.documentElement;
                if (!root) return false;
                root.classList.toggle("light", themeName === "light");
                return true;
              };
              if (!apply()) {
                const obs = new MutationObserver(() => apply() && obs.disconnect());
                obs.observe(document, { childList: true });
              }
            },
            [MOCK_AUTH_STORAGE_KEY, demoSession(), DEMO_LOCAL_SETTINGS, theme] as const,
          );
          const page = await context.newPage();
          await page.clock.setFixedTime(new Date(DEMO_NOW));
          const file = path.join(outDir, `${screen.name}.${vpName}.${theme}.png`);
          try {
            await screen.run(page);
            await settle(page);
            await page.screenshot({ path: file });
            if (screen.full) await captureFull(page, file.replace(/\.png$/, ".full.png"), vp);
            console.log(`✓ ${path.relative(process.cwd(), file)}`);
          } catch (err) {
            failures.push(`${screen.name} (${vpName}/${theme}): ${(err as Error).message.split("\n")[0]}`);
            console.warn(`✗ ${screen.name} ${vpName}/${theme}`);
          }
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }
  if (failures.length) {
    console.warn(`\n${failures.length} capture(s) failed:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  }
}

main();
