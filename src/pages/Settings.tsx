import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CurrencyDollar, Target, Bell, BellSlash, Trash, ArrowLeft } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface SettingsData {
  budgetGoal: number;
  currency: string;
  notifications: {
    overBudget: boolean;
    weeklyReport: boolean;
    dailyReminder: boolean;
  };
}

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "BRL", symbol: "R$", label: "Brazilian Real" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "CAD", symbol: "CA$", label: "Canadian Dollar" },
];

const SETTINGS_KEY = "fluxo_settings";

function loadSettings(): SettingsData {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (raw) return JSON.parse(raw);
  return {
    budgetGoal: 2000,
    currency: "USD",
    notifications: { overBudget: true, weeklyReport: false, dailyReminder: false },
  };
}

function saveSettings(data: SettingsData) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

const Settings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsData>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const update = (patch: Partial<SettingsData>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    toast.success("Settings saved");
  };

  const updateNotif = (key: keyof SettingsData["notifications"], val: boolean) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: val },
    }));
    toast.success("Settings saved");
  };

  const clearData = () => {
    localStorage.removeItem("fluxo_expenses");
    localStorage.removeItem("fluxo_seeded");
    toast.success("All expense data cleared");
  };

  return (
    <div className="min-h-screen bg-background pb-28 px-4 pt-4 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} weight="bold" />
          </button>
          <h2 className="font-display font-bold text-2xl text-foreground">Settings</h2>
        </div>
        <ThemeToggle />
      </motion.div>

      {/* Budget Goal */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Target size={20} weight="duotone" className="text-primary" />
          <h3 className="font-display font-bold text-foreground text-sm">Monthly Budget Goal</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-lg font-medium">
            {CURRENCIES.find((c) => c.code === settings.currency)?.symbol || "$"}
          </span>
          <Input
            type="number"
            value={settings.budgetGoal}
            onChange={(e) => update({ budgetGoal: Number(e.target.value) })}
            className="bg-muted border-none text-foreground font-display font-bold text-lg h-10"
          />
        </div>
      </motion.div>

      {/* Currency */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <CurrencyDollar size={20} weight="duotone" className="text-secondary" />
          <h3 className="font-display font-bold text-foreground text-sm">Currency</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => update({ currency: c.code })}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                settings.currency === c.code
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span className="block text-base">{c.symbol}</span>
              {c.code}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={20} weight="duotone" className="text-accent" />
          <h3 className="font-display font-bold text-foreground text-sm">Notifications</h3>
        </div>
        <div className="space-y-3">
          {[
            { key: "overBudget" as const, label: "Over budget alert", desc: "Notify when you exceed your monthly goal" },
            { key: "weeklyReport" as const, label: "Weekly report", desc: "Get a summary every Sunday" },
            { key: "dailyReminder" as const, label: "Daily reminder", desc: "Remind to log expenses" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-foreground text-sm font-medium">{item.label}</p>
                <p className="text-muted-foreground text-xs">{item.desc}</p>
              </div>
              <Switch
                checked={settings.notifications[item.key]}
                onCheckedChange={(val) => updateNotif(item.key, val)}
              />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Danger zone */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4">
        <button
          onClick={clearData}
          className="flex items-center gap-2 text-destructive text-sm font-medium hover:opacity-80 transition-opacity"
        >
          <Trash size={18} weight="duotone" />
          Clear all expense data
        </button>
      </motion.div>
    </div>
  );
};

export default Settings;
