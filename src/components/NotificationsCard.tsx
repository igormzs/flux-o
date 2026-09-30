import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BellRinging, BellSlash, DeviceMobile, Export, PaperPlaneTilt } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/hooks/useProfile";
import type { Settings } from "@/lib/settings";
import { currentSubscription, disablePush, enablePush, pushSupport, sendTestNotification, syncPush } from "@/lib/push";

type DeviceState = "loading" | "unsupported" | "needs-home-screen" | "blocked" | "off" | "on";

async function readDeviceState(): Promise<DeviceState> {
  const support = pushSupport();
  if (support !== "supported") return support;
  if (Notification.permission === "denied") return "blocked";
  return (await currentSubscription()) && Notification.permission === "granted" ? "on" : "off";
}

/**
 * Profile → Notifications. The weekly report setting is saved to the account
 * straight away; notifications are turned on per device (each phone or
 * browser asks for permission once).
 */
const NotificationsCard = () => {
  const { settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [device, setDevice] = useState<DeviceState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    readDeviceState().then((state) => {
      setDevice(state);
      if (state === "on") syncPush().catch(() => {});
    });
  }, []);

  // Switches flipped here but not yet confirmed by the server. Every save
  // includes all of them, so two quick taps can't undo each other.
  const flipped = useRef<Partial<Settings["notifications"]>>({});
  const [, rerender] = useState(0);
  const notifications = { ...settings.notifications, ...flipped.current };

  const setNotification = (key: "weeklyReport" | "dailyReminder", on: boolean) => {
    flipped.current = { ...flipped.current, [key]: on };
    rerender((n) => n + 1);
    updateSettings.mutate({ notifications: { ...settings.notifications, ...flipped.current } }, {
      onError: (err) => {
        delete flipped.current[key];
        rerender((n) => n + 1);
        toast.error(`Couldn't save: ${err.message}`);
      },
    });
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      const permission = await enablePush();
      if (permission === "granted") {
        setDevice("on");
        if (!notifications.weeklyReport) setNotification("weeklyReport", true);
        toast.success("Notifications are on for this device");
      } else {
        setDevice(permission === "denied" ? "blocked" : "off");
      }
    } catch (err) {
      toast.error(`Couldn't turn on notifications: ${(err as Error).message}`);
      setDevice(await readDeviceState());
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disablePush();
      setDevice("off");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await sendTestNotification();
      if (r.sent > 0) toast.success(r.sent === 1 ? "Sent. It should arrive in a few seconds." : `Sent to ${r.sent} devices`);
      else toast.error("Nothing was delivered. Try turning notifications off and on again.");
    } catch (err) {
      toast.error(`Couldn't send: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-4 mb-4" data-testid="notifications-card">
      <h3 className="font-display font-bold text-foreground text-sm mb-3">Notifications</h3>

      <div className="rounded-xl bg-muted/60 p-3 mb-4">
        <div className="flex items-start gap-3">
          <DeviceMobile size={20} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-foreground text-sm font-medium">This device</p>
            <p className="text-muted-foreground text-xs" data-testid="device-status">
              {device === "loading" && "Checking…"}
              {device === "on" && "On. Notifications arrive here, even when Flux-o is closed."}
              {device === "off" && "Off. Turn them on to get the weekly report and reminders here."}
              {device === "blocked" && "Blocked. Allow notifications for Flux-o in your phone or browser settings, then come back."}
              {device === "unsupported" && "This browser can't show notifications."}
              {device === "needs-home-screen" && (
                <>On iPhone, add Flux-o to your Home Screen first: tap <Export size={12} className="inline -mt-0.5" /> Share → Add to Home Screen, then open it from there.</>
              )}
            </p>
          </div>
        </div>
        {(device === "off" || device === "on") && (
          <div className="flex flex-wrap gap-2 mt-3 pl-8">
            {device === "off" ? (
              <button onClick={turnOn} disabled={busy} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                <BellRinging size={16} weight="bold" /> Turn on for this device
              </button>
            ) : (
              <>
                <button onClick={test} disabled={busy} className="h-9 px-3 rounded-lg bg-primary/15 text-primary text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  <PaperPlaneTilt size={16} weight="bold" /> Send a test
                </button>
                <button onClick={turnOff} disabled={busy} className="h-9 px-3 rounded-lg text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                  <BellSlash size={16} /> Turn off here
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-foreground text-sm font-medium">Weekly report</p>
            <p className="text-muted-foreground text-xs">Mondays at 9:00: last week’s total, the change and your top category</p>
          </div>
          <Switch checked={notifications.weeklyReport} onCheckedChange={(on) => setNotification("weeklyReport", on)} aria-label="Weekly report" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-foreground text-sm font-medium">Catch-up reminder</p>
            <p className="text-muted-foreground text-xs">Around 19:00 when nothing’s been logged for 3 days, and once more after a week</p>
          </div>
          <Switch checked={notifications.dailyReminder} onCheckedChange={(on) => setNotification("dailyReminder", on)} aria-label="Catch-up reminder" />
        </div>
        <div className="flex items-center justify-between gap-3 opacity-60">
          <div>
            <p className="text-foreground text-sm font-medium">
              Over budget alert <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground bg-muted rounded px-1.5 py-0.5">Coming soon</span>
            </p>
            <p className="text-muted-foreground text-xs">When you go past your monthly goal</p>
          </div>
          <Switch checked={false} disabled aria-label="Over budget alert" />
        </div>
      </div>
    </motion.div>
  );
};

export default NotificationsCard;
