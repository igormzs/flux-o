import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowCounterClockwise } from "@phosphor-icons/react";
import { addDays, format, subDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { cycleKey, cycleStart, MAX_PAYDAY_SHIFT_DAYS, nominalStartOfCycle, type DateRange } from "@/lib/date-utils";
import type { Settings, WeekendRule } from "@/lib/settings";
import { useUpdateSettings } from "@/hooks/useProfile";

const WEEKEND_RULES: { id: WeekendRule; label: string }[] = [
  { id: "none", label: "Keep the day" },
  { id: "before", label: "Friday before" },
  { id: "after", label: "Monday after" },
];

const iso = (d: Date) => format(d, "yyyy-MM-dd");

interface PaydaySheetProps {
  open: boolean;
  onClose: () => void;
  /** The cycle being viewed; its start is what the user can move. */
  cycle: DateRange;
  settings: Settings;
}

/**
 * "My cycle is 25th to 25th, but payday moves." Lets the user say when this
 * cycle's salary actually arrived (a one-off move of up to 10 days), and what
 * usually happens when the cycle day falls on a weekend.
 */
const PaydaySheet = ({ open, onClose, cycle, settings }: PaydaySheetProps) => {
  const update = useUpdateSettings();
  const nominal = nominalStartOfCycle(cycle, settings.cycleDay);
  const key = cycleKey(nominal);
  const override = settings.cycleOverrides[key];
  // Where the cycle would start with the weekend rule alone.
  const byRule = cycleStart(nominal.getFullYear(), nominal.getMonth(), settings.cycleDay, { weekendRule: settings.weekendRule });
  const [value, setValue] = useState(iso(cycle.start));
  useEffect(() => {
    if (open) setValue(iso(cycle.start));
  }, [open, cycle.start]);

  const min = iso(subDays(nominal, MAX_PAYDAY_SHIFT_DAYS));
  const max = iso(addDays(nominal, MAX_PAYDAY_SHIFT_DAYS));
  const valid = value >= min && value <= max;

  const saveOverrides = (next: Record<string, string>, message: string) =>
    update.mutate({ cycleOverrides: next }, {
      onSuccess: () => { toast.success(message); onClose(); },
      onError: (err) => toast.error(err.message),
    });

  const handleSave = () => {
    if (!valid) return;
    const next = { ...settings.cycleOverrides };
    if (value === iso(byRule)) delete next[key];
    else next[key] = value;
    saveOverrides(next, `Cycle now starts ${format(new Date(`${value}T00:00:00`), "EEE, MMM d")}`);
  };

  const handleReset = () => {
    const next = { ...settings.cycleOverrides };
    delete next[key];
    saveOverrides(next, "Back to the usual day");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payday-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-glass-border rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-auto scrollbar-none max-w-xl mx-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 id="payday-title" className="font-display font-bold text-xl text-foreground">Payday moved?</h2>
              <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                <X size={16} weight="bold" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              This cycle usually starts on <span className="text-foreground font-medium">{format(nominal, "EEE, MMM d")}</span>.
              If your salary arrived on another day, pick it and the cycle will start then. Only this cycle and the one before it change.
            </p>

            <label htmlFor="payday-date" className="text-sm text-muted-foreground mb-1.5 block">This cycle started on</label>
            <div className="flex gap-2 mb-1">
              <input
                id="payday-date"
                type="date"
                value={value}
                min={min}
                max={max}
                onChange={(e) => setValue(e.target.value)}
                className="flex-1 h-11 rounded-xl bg-muted px-4 text-foreground text-base md:text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              {override && (
                <button onClick={handleReset} className="h-11 px-3 rounded-xl bg-muted text-sm text-foreground flex items-center gap-1.5 hover:bg-muted/80">
                  <ArrowCounterClockwise size={14} weight="bold" /> Usual day
                </button>
              )}
            </div>
            <p className={cn("text-xs mb-6", valid ? "text-muted-foreground" : "text-destructive")}>
              Up to {MAX_PAYDAY_SHIFT_DAYS} days before or after the usual day ({format(new Date(`${min}T00:00:00`), "MMM d")} – {format(new Date(`${max}T00:00:00`), "MMM d")}).
            </p>

            <p className="text-sm text-muted-foreground mb-2">When day {settings.cycleDay} is on a weekend, my cycle starts</p>
            <div role="radiogroup" aria-label="Weekend rule" className="grid grid-cols-3 gap-2 mb-6">
              {WEEKEND_RULES.map((r) => (
                <button
                  key={r.id}
                  role="radio"
                  aria-checked={settings.weekendRule === r.id}
                  onClick={() => update.mutate({ weekendRule: r.id }, { onError: (err) => toast.error(err.message) })}
                  className={cn(
                    "rounded-xl px-2 py-2.5 text-xs font-medium border transition-all",
                    settings.weekendRule === r.id ? "bg-primary/20 text-primary border-primary/30" : "bg-muted text-muted-foreground border-transparent hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={!valid || update.isPending || value === iso(cycle.start)}
              className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-display font-bold disabled:opacity-30"
            >
              {update.isPending ? "Saving…" : "Save"}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PaydaySheet;
