import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, SignOut, HandWaving } from "@phosphor-icons/react";
import ThemeToggle from "@/components/ThemeToggle";
import { getExpenses, deleteExpense, Expense, getCustomCategories, CustomCategory } from "@/lib/expenses";
import BalanceCard from "@/components/BalanceCard";
import TransactionCard from "@/components/TransactionCard";
import SpendingChart from "@/components/SpendingChart";
import AddExpenseSheet from "@/components/AddExpenseSheet";
import ExpenseDetailSheet from "@/components/ExpenseDetailSheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getPeriodRange } from "@/lib/date-utils";
import { isWithinInterval, format } from "date-fns";
import { Link } from "react-router-dom";
import { User } from "@phosphor-icons/react";
import { getCurrencySymbol } from "@/lib/currencies";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; username?: string; avatar_url?: string | null }>({});
  const [displayName, setDisplayName] = useState(() => localStorage.getItem("fluxo_display_name") || "");

  const handleEditClick = (expense: Expense) => {
    setExpenseToEdit(expense);
    setSelectedExpense(null); // Close Details Sheet
    setShowAdd(true); // Open Edit Sheet
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("first_name, last_name, username, avatar_url").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data);
        const name = data.first_name || data.username || user.email?.split("@")[0] || "there";
        setDisplayName(name);
        localStorage.setItem("fluxo_display_name", name);
      }
    });
  }, [user]);

  const initials = profile.first_name && profile.last_name 
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : profile.first_name 
      ? profile.first_name.substring(0, 2).toUpperCase()
      : "IM";

  const refresh = useCallback(async () => {
    try {
      const [exps, cats] = await Promise.all([getExpenses(), getCustomCategories()]);
      setExpenses(exps);
      setCustomCategories(cats);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const settings = JSON.parse(localStorage.getItem("fluxo_settings") || "{}");
  const range = getPeriodRange(settings);
  const currencySymbol = getCurrencySymbol(settings.currency || "USD");
  
  const periodExpenses = expenses.filter((e) => {
    try {
      return isWithinInterval(new Date(e.date), range);
    } catch (err) {
      return false;
    }
  });

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const periodTotal = periodExpenses.reduce((s, e) => s + e.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8 px-4 md:px-8 pt-4 md:pt-8 w-full max-w-7xl mx-auto overflow-x-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-8">
        <div>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            Welcome back <HandWaving size={16} className="text-yellow" weight="fill" />
          </p>
          <h2 className="font-display font-bold text-xl text-foreground">
            {displayName || "Flux-o"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/profile" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-glass-border hover:border-primary/50 transition-colors">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-primary">{initials}</span>
            )}
          </Link>
          <button onClick={() => signOut()} className="hidden md:flex w-9 h-9 rounded-full bg-muted items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
            <SignOut size={18} weight="bold" />
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Metrics Area */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <BalanceCard totalSpent={totalSpent} thisMonth={periodTotal} currencySymbol={currencySymbol} />
          <SpendingChart 
            expenses={periodExpenses} 
            customCategories={customCategories} 
            dateRange={settings.periodType === 'all' ? 'All Time' : `${format(range.start, 'MMM d')} - ${format(range.end, 'MMM d')}`}
          />
        </div>

        {/* Side Rail Area */}
        <div className="flex flex-col gap-6">
          <div className="bg-card/40 backdrop-blur-xl border border-glass-border rounded-2xl p-6 shadow-xl shadow-black/5 flex flex-col h-full max-h-[600px]">
            <h3 className="font-display font-bold text-foreground mb-4 text-sm">Recent Transactions</h3>
            {expenses.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center py-6">
                <p className="text-muted-foreground text-sm">No expenses yet. Tap + to add one!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto pr-2 scrollbar-none flex-1">
                {expenses.slice(0, 10).map((exp, i) => (
                  <TransactionCard
                    key={exp.id}
                    expense={exp}
                    index={i}
                    onTap={setSelectedExpense}
                    customCategories={customCategories}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => { setExpenseToEdit(null); setShowAdd(true); }}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center z-40"
      >
        <Plus size={24} weight="bold" />
      </motion.button>

      <AddExpenseSheet 
        open={showAdd} 
        onClose={() => { setShowAdd(false); setExpenseToEdit(null); }} 
        onAdded={refresh} 
        expense={expenseToEdit} 
      />
      <ExpenseDetailSheet
        expense={selectedExpense}
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onDelete={handleDelete}
        onEdit={handleEditClick}
        customCategories={customCategories}
      />
    </div>
  );
};

export default Dashboard;
