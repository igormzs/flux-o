/**
 * Flux-o notifications (Supabase Edge Function).
 *
 * POST, called two ways:
 *  - By the hourly schedule (pg_cron), with the `x-cron-secret` header: sends
 *    the Monday weekly report to everyone it's due for (9:00 in their time
 *    zone), once per week.
 *  - By the app, signed in, with {"type":"test"}: sends the signed-in user a
 *    preview of their weekly report on every device they turned on.
 *
 * Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, NOTIFY_CRON_SECRET.
 * Deployed with JWT verification off (supabase/config.toml): the schedule
 * has no user token, so this function checks the secret or the user itself.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendPush, type VapidKeys } from "../_shared/webpush.ts";
import { isReportDue, reportWeek, safeTimeZone, weeklyMessage, weekTotals } from "../_shared/weekly.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const vapid: VapidKeys = {
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
  subject: Deno.env.get("VAPID_SUBJECT") ?? "https://flux-o.vercel.app",
};

interface Profile { id: string; currency: string | null; notifications: { weeklyReport?: boolean } | null; timezone: string | null }
interface Subscription { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

/** The report for the last finished week, for one user. */
async function buildReport(db: SupabaseClient, profile: Profile, now: Date) {
  const tz = safeTimeZone(profile.timezone);
  const currency = profile.currency ?? "EUR";
  const week = reportWeek(now, tz);
  const [{ data: expenses, error }, { data: custom }] = await Promise.all([
    db.from("expenses").select("amount, category, currency, date")
      .eq("user_id", profile.id).gte("date", week.prevStart.toISOString()).lt("date", week.end.toISOString()),
    db.from("custom_categories").select("id, label, builtin_key").eq("user_id", profile.id),
  ]);
  if (error) throw error;
  const message = weeklyMessage(weekTotals(expenses ?? [], week, currency, custom ?? []), currency);
  return { ...message, week, url: `/insights?scope=week&at=${week.key}` };
}

/** Send to every device of one user; removes devices the push service says are gone. */
async function sendToUser(db: SupabaseClient, subs: Subscription[], payload: Record<string, unknown>) {
  let sent = 0, removed = 0, failed = 0;
  for (const sub of subs) {
    try {
      const res = await sendPush(sub, payload, vapid);
      if (res.gone) {
        await db.from("push_subscriptions").delete().eq("id", sub.id);
        removed++;
      } else if (res.status >= 200 && res.status < 300) {
        await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", sub.id);
        sent++;
      } else {
        console.error(`push ${res.status} for subscription ${sub.id}`);
        failed++;
      }
    } catch (err) {
      console.error(`push failed for subscription ${sub.id}:`, err);
      failed++;
    }
  }
  return { sent, removed, failed };
}

async function runWeekly(db: SupabaseClient, now: Date) {
  const { data: subs, error } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
  if (error) throw error;
  const byUser = new Map<string, Subscription[]>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  if (byUser.size === 0) return { users: 0 };

  const { data: profiles, error: pErr } = await db.from("profiles").select("id, currency, notifications, timezone").in("id", [...byUser.keys()]);
  if (pErr) throw pErr;
  const results: Record<string, unknown>[] = [];
  for (const profile of (profiles ?? []) as Profile[]) {
    if (!profile.notifications?.weeklyReport) continue;
    const tz = safeTimeZone(profile.timezone);
    if (!isReportDue(now, tz)) continue;
    const report = await buildReport(db, profile, now);
    // Claim this week's report first, so overlapping runs never send it twice.
    const { data: claimed } = await db.from("notification_log")
      .upsert({ user_id: profile.id, kind: "weekly", period_key: report.week.key }, { onConflict: "user_id,kind,period_key", ignoreDuplicates: true })
      .select();
    if (!claimed?.length) continue;
    const out = await sendToUser(db, byUser.get(profile.id)!, { title: report.title, body: report.body, url: report.url, tag: `weekly-${report.week.key}` });
    // Nothing got through (and not because the devices are gone): try again next hour.
    if (out.sent === 0 && out.failed > 0) {
      await db.from("notification_log").delete().match({ user_id: profile.id, kind: "weekly", period_key: report.week.key });
    }
    results.push({ user: profile.id, ...out });
  }
  return { users: results.length, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!vapid.publicKey || !vapid.privateKey) return json({ error: "VAPID keys are not set" }, 500);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const now = new Date();

  const cronSecret = Deno.env.get("NOTIFY_CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) {
    try {
      return json(await runWeekly(db, now));
    } catch (err) {
      console.error(err);
      return json({ error: String(err) }, 500);
    }
  }

  // Called from the app: only for the signed-in user.
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  const { data: { user } } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!user) return json({ error: "Not signed in" }, 401);
  const body = await req.json().catch(() => ({}));
  if (body.type !== "test") return json({ error: "Unknown request" }, 400);

  const { data: subs } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").eq("user_id", user.id);
  if (!subs?.length) return json({ sent: 0, removed: 0, failed: 0, devices: 0 });
  const { data: profile } = await db.from("profiles").select("id, currency, notifications, timezone").eq("id", user.id).single();
  const report = await buildReport(db, profile as Profile, now);
  const out = await sendToUser(db, subs, { title: `Preview · ${report.title}`, body: report.body, url: report.url, tag: "test" });
  return json({ ...out, devices: subs.length });
});
