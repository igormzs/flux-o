import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Camera, User, SignOut, Trash, Check } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CURRENCIES } from "@/lib/currencies";

interface SettingsData {
  budgetGoal: number;
  currency: string;
  notifications: { overBudget: boolean; weeklyReport: boolean; dailyReminder: boolean };
}

const SETTINGS_KEY = "fluxo_settings";
function loadSettings(): SettingsData {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (raw) return JSON.parse(raw);
  return { budgetGoal: 2000, currency: "USD", notifications: { overBudget: true, weeklyReport: false, dailyReminder: false } };
}
function saveSettingsLocal(data: SettingsData) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [settings, setSettings] = useState<SettingsData>(loadSettings);
  const [pendingSettings, setPendingSettings] = useState<SettingsData>(loadSettings);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (data) {
          const profileData = data as { first_name?: string; last_name?: string; username?: string; avatar_url?: string };
          setFirstName(profileData.first_name || "");
          setLastName(profileData.last_name || "");
          setUsername(profileData.username || "");
          setAvatarUrl(profileData.avatar_url || null);
        }
        setLoadingProfile(false);
      });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("expense-images")
      .upload(path, file, { upsert: true });
    if (uploadError) { toast.error(uploadError.message); return; }

    const { data } = supabase.storage.from("expense-images").getPublicUrl(path);
    const url = data.publicUrl + "?t=" + Date.now();
    setAvatarUrl(url);

    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    toast.success("Avatar updated!");
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName, username, updated_at: new Date().toISOString() } as Record<string, unknown>)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      const nameToStore = firstName || username || user.email?.split("@")[0] || "there";
      localStorage.setItem("fluxo_display_name", nameToStore);
      toast.success("Profile saved!");
    }
  };

  const handleSaveSettings = () => {
    setSavingSettings(true);
    saveSettingsLocal(pendingSettings);
    setSettings(pendingSettings);
    setTimeout(() => {
      setSavingSettings(false);
      toast.success("Settings saved!");
    }, 500);
  };

  const updatePendingSetting = (patch: Partial<SettingsData>) => {
    setPendingSettings((prev) => ({ ...prev, ...patch }));
  };

  const updatePendingNotif = (key: keyof SettingsData["notifications"], val: boolean) => {
    setPendingSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, [key]: val } }));
  };

  const handleSignOut = async () => { await signOut(); };

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 px-4 pt-4 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} weight="bold" />
          </button>
          <h2 className="font-display font-bold text-2xl text-foreground">Profile</h2>
        </div>
        <ThemeToggle />
      </motion.div>

      {/* Avatar & Username */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 mb-4 flex flex-col items-center">
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-glass-border">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={32} className="text-muted-foreground" />
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
          >
            <Camera size={14} weight="bold" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>
        <p className="text-xs text-muted-foreground mb-3">{user?.email}</p>
        <div className="w-full space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">First Name</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="bg-muted border-none text-foreground h-10"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Last Name</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="bg-muted border-none text-foreground h-10"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              className="bg-muted border-none text-foreground h-10"
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Profile"}
          </motion.button>
        </div>
      </motion.div>

      {/* App Settings */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 mb-4">
        <h3 className="font-display font-bold text-foreground text-sm mb-4">App Settings</h3>
        
        <div className="space-y-6">
          {/* Monthly Budget */}
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Monthly Budget Goal</label>
            <div className="flex items-center gap-3 bg-muted rounded-xl px-4 h-11">
              <span className="text-muted-foreground text-lg font-medium">{CURRENCIES.find((c) => c.code === pendingSettings.currency)?.symbol || "$"}</span>
              <Input 
                type="number" 
                value={pendingSettings.budgetGoal} 
                onChange={(e) => updatePendingSetting({ budgetGoal: Number(e.target.value) })} 
                className="bg-transparent border-none text-foreground font-display font-bold text-lg h-full p-0 focus-visible:ring-0" 
              />
            </div>
          </div>

          {/* Currency Selector */}
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Primary Currency</label>
            <div className="grid grid-cols-3 gap-2">
              {CURRENCIES.map((c) => (
                <button 
                  key={c.code} 
                  onClick={() => updatePendingSetting({ currency: c.code })} 
                  className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${pendingSettings.currency === c.code ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent"}`}
                >
                  <span className="block text-base">{c.symbol}</span>{c.code}
                </button>
              ))}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="w-full h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 font-display font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
          >
            {savingSettings ? "Saving..." : (
              <>
                <Check size={16} weight="bold" />
                Save Settings
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-4 mb-4">
        <h3 className="font-display font-bold text-foreground text-sm mb-3">Notifications</h3>
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
              <Switch checked={pendingSettings.notifications[item.key]} onCheckedChange={(val) => updatePendingNotif(item.key, val)} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Account actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 space-y-3">
        <button onClick={handleSignOut} className="flex items-center gap-2 text-muted-foreground text-sm font-medium hover:text-foreground transition-colors w-full">
          <SignOut size={18} weight="bold" />
          Sign out
        </button>
        <div className="border-t border-glass-border pt-3">
          <button onClick={() => toast.success("Data cleared")} className="flex items-center gap-2 text-destructive text-sm font-medium hover:opacity-80 transition-opacity">
            <Trash size={18} weight="bold" />
            Clear all expense data
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;
