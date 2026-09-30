import { supabase } from "@/integrations/supabase/client";

/**
 * Push notifications for this device. The matching private key is a secret of
 * the `notify` Edge Function; this one is public by design (browsers need it
 * to subscribe). VITE_VAPID_PUBLIC_KEY overrides it (the push smoke test uses
 * its own key pair).
 */
export const VAPID_PUBLIC_KEY: string =
  import.meta.env.VITE_VAPID_PUBLIC_KEY || "BLB3toHl6bxMcc8l0BgV4heG9XYo5rp4Gd0asRFyoUQJjYyCLTas9CCUb7yORGkxJlvGnkZK0oj-_iYendCpJRs";

export type PushSupport = "supported" | "needs-home-screen" | "unsupported";

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone and iPad only allow web push from an app added to the Home Screen (iOS 16.4+). */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  if ("PushManager" in window && "Notification" in window) return "supported";
  return isIOS() && !isStandalone() ? "needs-home-screen" : "unsupported";
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** This device's subscription, if notifications are on here. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Save this device for the signed-in user (and their time zone for the report). */
async function saveSubscription(sub: PushSubscription) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth, user_agent: navigator.userAgent.slice(0, 300) },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw error;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await supabase.from("profiles").update({ timezone }).eq("id", user.id);
}

/**
 * Ask for permission and turn notifications on for this device. Call it
 * straight from a tap: iOS only shows the permission prompt for one.
 */
export async function enablePush(): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  await registerServiceWorker();
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  await saveSubscription(sub);
  return permission;
}

/** Keep the saved device and time zone up to date (e.g. after travelling). */
export async function syncPush(): Promise<boolean> {
  const sub = await currentSubscription();
  if (!sub || Notification.permission !== "granted") return false;
  await saveSubscription(sub);
  return true;
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export interface TestResult { sent: number; removed: number; failed: number; devices: number }

/** Send the signed-in user a preview of their weekly report, on every device they turned on. */
export async function sendTestNotification(): Promise<TestResult> {
  const { data, error } = await supabase.functions.invoke<TestResult>("notify", { body: { type: "test" } });
  if (error) throw error;
  return data!;
}
