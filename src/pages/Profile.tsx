import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Camera, User, SignOut, Trash, Check, CaretRight } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationsCard from "@/components/NotificationsCard";
import StoredImage from "@/components/StoredImage";
import { uploadImage } from "@/lib/storage";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CURRENCIES, formatMoney } from "@/lib/currencies";
import { useProfile, useSettings, useUpdateProfile, useUpdateSettings } from "@/hooks/useProfile";
import type { DefaultScope, Settings, WeekendRule } from "@/lib/settings";
import { expenseKeys, useCustomCategories, useRecurringExpenses } from "@/hooks/useExpenses";
import { monthlyTotal } from "@/lib/recurring";
import { useQueryClient } from "@tanstack/react-query";
import { clearExpenseData } from "@/lib/expenses";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { allCategories, categoryStyle } from "@/lib/categories";
import CategoryIcon from "@/components/CategoryIcon";

const SCOPE_LABELS: Record<DefaultScope, string> = {
  cycle: "Billing cycle",
  month: "Month",
  week: "Week",
  last30: "Last 30 days",
  all: "All time",
};

const WEEKEND_RULE_LABELS: [WeekendRule, string][] = [
  ["none", "On that day"],
  ["before", "Friday before"],
  ["after", "Monday after"],
];

const Profile = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClearData = async () => {
    setClearing(true);
    try {
      const n = await clearExpenseData();
      await queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      toast.success(n === 1 ? "Deleted 1 expense" : `Deleted ${n} expenses`);
      setConfirmClear(false);
    } catch (err) {
      toast.error(`Couldn't clear your data: ${(err as Error).message}`);
    } finally {
      setClearing(false);
    }
  };
  const { user, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { settings } = useSettings();
  const updateProfile = useUpdateProfile();
  const updateSettings = useUpdateSettings();
  const { data: customCategories = [] } = useCustomCategories();
  const categories = allCategories(customCategories);
  const { data: recurring = [] } = useRecurringExpenses();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [pendingSettings, setPendingSettings] = useState<Settings>(settings);

  // Fill the forms once the profile arrives.
  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name || "");
    setLastName(profile.last_name || "");
    setUsername(profile.username || "");
  }, [profile]);

  // When saved values change (the profile loads, or another card saves one
  // setting), update only those fields, keeping any unsaved edits to the rest.
  const savedSettings = useRef(settings);
  useEffect(() => {
    const before = savedSettings.current;
    savedSettings.current = settings;
    setPendingSettings((pending) => {
      const next = { ...pending };
      for (const key of Object.keys(settings) as (keyof Settings)[]) {
        if (JSON.stringify(before[key]) !== JSON.stringify(settings[key])) Object.assign(next, { [key]: settings[key] });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the saved values change
  }, [JSON.stringify(settings)]);

  const avatarUrl = profile?.avatar_url ?? null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    let path: string;
    try {
      path = await uploadImage(file, `avatar.${ext}`, true);
    } catch (err) {
      toast.error((err as Error).message);
      return;
    }
    // The query changes the stored value, so the new photo gets a fresh link.
    const url = `${path}?t=${Date.now()}`;
    updateProfile.mutate({ avatar_url: url }, {
      onSuccess: () => toast.success("Avatar updated!"),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleSaveProfile = () => {
    updateProfile.mutate({ first_name: firstName, last_name: lastName, username }, {
      onSuccess: () => toast.success("Profile saved!"),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleSaveSettings = () => {
    updateSettings.mutate(pendingSettings, {
      onSuccess: () => toast.success("Settings saved!"),
      onError: (err) => toast.error(err.message),
    });
  };

  const updatePendingSetting = (patch: Partial<Settings>) => {
    setPendingSettings((prev) => ({ ...prev, ...patch }));
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
    <div className="min-h-screen bg-background pb-24 px-8 pt-8 max-w-lg mx-auto">
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
            <StoredImage value={avatarUrl} alt="Avatar" className="w-full h-full object-cover" fallback={<User size={32} className="text-muted-foreground" />} />
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
            disabled={updateProfile.isPending}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm disabled:opacity-50"
          >
            {updateProfile.isPending ? "Saving..." : "Save Profile"}
          </motion.button>
        </div>
      </motion.div>

      {/* App Settings */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 mb-4">
        <h3 className="font-display font-bold text-foreground text-sm mb-4">App Settings</h3>
        
        <div className="space-y-6">
          {/* Monthly Budget */}
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Budget goal</label>
            <div className="flex items-center gap-3 bg-muted rounded-xl px-4 h-11 border border-transparent focus-within:border-primary/20 focus-within:bg-muted/80 transition-all">
              <span className="text-muted-foreground text-lg font-medium">{CURRENCIES.find((c) => c.code === pendingSettings.currency)?.symbol || "$"}</span>
              <Input 
                type="number" 
                value={pendingSettings.budgetGoal} 
                onChange={(e) => updatePendingSetting({ budgetGoal: Number(e.target.value) })} 
                className="bg-transparent border-none text-foreground font-display font-bold text-lg h-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 outline-none" 
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Counted per pay cycle and shown on Home. Set it to 0 to hide the budget bar.</p>
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

          {/* Billing cycle day: used by the Home total and the Insights cycles */}
          <div>
            <label htmlFor="cycle-day" className="text-xs text-muted-foreground block mb-2">Billing Cycle Start Day</label>
            <Input
              id="cycle-day"
              type="number"
              min={1}
              max={31}
              value={pendingSettings.cycleDay}
              onChange={(e) => updatePendingSetting({ cycleDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
              className="bg-muted border-none text-foreground font-bold h-11 text-base md:text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Your cycle runs from day {pendingSettings.cycleDay} to the day before it next month. Days past a month's end use its last day.
            </p>
          </div>

          {/* Payday on a weekend (Phase 1b) */}
          <div>
            <label className="text-xs text-muted-foreground block mb-2">When day {pendingSettings.cycleDay} is on a weekend, start the cycle</label>
            <div role="radiogroup" aria-label="Weekend rule" className="grid grid-cols-3 gap-2">
              {WEEKEND_RULE_LABELS.map(([rule, text]) => (
                <button
                  key={rule}
                  role="radio"
                  aria-checked={pendingSettings.weekendRule === rule}
                  onClick={() => updatePendingSetting({ weekendRule: rule })}
                  className={`rounded-xl px-2 py-2.5 text-xs font-medium transition-all border ${pendingSettings.weekendRule === rule ? "bg-primary/20 text-primary border-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/80 border-transparent"}`}
                >
                  {text}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              For a one-off change, open the cycle in Insights and tap “Payday moved?”.
            </p>
          </div>

          {/* Display Period */}
          <div>
            <label className="text-xs text-muted-foreground block mb-2">Display Period</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SCOPE_LABELS) as DefaultScope[]).map((scope) => (
                <button
                  key={scope}
                  onClick={() => updatePendingSetting({ defaultScope: scope })}
                  className={`rounded-xl px-3 py-2.5 text-[10px] uppercase font-bold tracking-tight transition-all ${pendingSettings.defaultScope === scope ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  {SCOPE_LABELS[scope]}
                </button>
              ))}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSaveSettings}
            disabled={updateSettings.isPending}
            className="w-full h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 font-display font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
          >
            {updateSettings.isPending ? "Saving..." : (
              <>
                <Check size={16} weight="bold" />
                Save Settings
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Categories */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={() => navigate("/categories")}
        data-testid="manage-categories"
        className="glass-card p-4 mb-4 w-full flex items-center gap-3 text-left hover:bg-card/80 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-foreground text-sm">Categories</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{categories.length} categories · create, edit, reorder</p>
          <div className="flex gap-1.5 mt-3" aria-hidden>
            {categories.slice(0, 7).map((c) => (
              <span key={c.id} style={categoryStyle(c.color)} className="cat cat-soft w-8 h-8 rounded-lg flex items-center justify-center">
                <CategoryIcon categoryId={c.id} customIcon={c.icon} size={16} />
              </span>
            ))}
            {categories.length > 7 && (
              <span className="w-8 h-8 rounded-lg bg-muted text-muted-foreground text-[11px] font-medium flex items-center justify-center">+{categories.length - 7}</span>
            )}
          </div>
        </div>
        <CaretRight size={18} weight="bold" className="text-muted-foreground shrink-0" />
      </motion.button>

      {/* Recurring expenses */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        onClick={() => navigate("/recurring")}
        data-testid="manage-recurring"
        className="glass-card p-4 mb-4 w-full flex items-center gap-3 text-left hover:bg-card/80 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-foreground text-sm">Recurring expenses</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {recurring.length === 0
              ? "Rent, utilities, subscriptions: set up once, confirm each month"
              : `${recurring.filter((b) => b.active).length} active · ${formatMoney(monthlyTotal(recurring, settings.currency), settings.currency)} a month`}
          </p>
        </div>
        <CaretRight size={18} weight="bold" className="text-muted-foreground shrink-0" />
      </motion.button>

      <NotificationsCard />

      {/* Account actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 space-y-3">
        <button onClick={handleSignOut} className="flex items-center gap-2 text-muted-foreground text-sm font-medium hover:text-foreground transition-colors w-full">
          <SignOut size={18} weight="bold" />
          Sign out
        </button>
        <div className="border-t border-glass-border pt-3">
          <button onClick={() => setConfirmClear(true)} className="flex items-center gap-2 text-destructive text-sm font-medium hover:opacity-80 transition-opacity">
            <Trash size={18} weight="bold" />
            Clear all expense data
          </button>
        </div>
        <AlertDialog open={confirmClear} onOpenChange={(v) => !clearing && setConfirmClear(v)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all your expenses?</AlertDialogTitle>
              <AlertDialogDescription>
                Every expense and receipt photo is deleted for good. Your categories, settings and profile stay. This can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={clearing}
                onClick={(e) => { e.preventDefault(); handleClearData(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {clearing ? "Deleting…" : "Delete everything"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </div>
  );
};

export default Profile;
