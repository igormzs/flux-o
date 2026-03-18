import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, SignOut } from "@phosphor-icons/react";
import ThemeToggle from "@/components/ThemeToggle";
import { getExpenses, deleteExpense, Expense, getCustomCategories, CustomCategory } from "@/lib/expenses";
import BalanceCard from "@/components/BalanceCard";
import TransactionCard from "@/components/TransactionCard";
import SpendingChart from "@/components/SpendingChart";
import AddExpenseSheet from "@/components/AddExpenseSheet";
import ExpenseDetailSheet from "@/components/ExpenseDetailSheet";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username").eq("id", user.id).single().then(({ data }) => {
      const name = data?.username || user.email?.split("@")[0] || "there";
      setDisplayName(name.split(/[\s_.-]/)[0]);
    });
  }, [user]);

  const refresh = useCallback(async () => {
    try {
      const [exps, cats] = await Promise.all([getExpenses(), getCustomCategories()]);
      setExpenses(exps);
      setCustomCategories(cats);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const now = new Date();
  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 px-4 pt-4 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-4">
        <div>
          <p className="text-muted-foreground text-sm">Welcome back 👋</p>
          <h2 className="font-display font-bold text-xl text-foreground">
            {displayName || "Flux-o"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => signOut()} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
            <SignOut size={18} weight="bold" />
          </button>
        </div>
      </motion.div>

      <div className="mb-4">
        <BalanceCard totalSpent={totalSpent} thisMonth={thisMonth} />
      </div>

      <div className="mb-4">
        <SpendingChart expenses={thisMonthExpenses} customCategories={customCategories} />
      </div>

      <div className="mb-4">
        <h3 className="font-display font-bold text-foreground mb-2 text-sm">Recent</h3>
        {expenses.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="text-muted-foreground text-sm">No expenses yet. Tap + to add one!</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none -mx-4 px-4">
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

      <motion.button
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center z-40"
      >
        <Plus size={24} weight="bold" />
      </motion.button>

      <AddExpenseSheet open={showAdd} onClose={() => setShowAdd(false)} onAdded={refresh} />
      <ExpenseDetailSheet
        expense={selectedExpense}
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onDelete={handleDelete}
        customCategories={customCategories}
      />
    </div>
  );
};

export default Dashboard;
