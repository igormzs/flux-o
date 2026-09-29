import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, SignOut, HandWaving } from "@phosphor-icons/react";
import ThemeToggle from "@/components/ThemeToggle";
import StoredImage from "@/components/StoredImage";
import { Expense } from "@/lib/expenses";
import BalanceCard from "@/components/BalanceCard";
import TransactionCard from "@/components/TransactionCard";
import SpendingChart from "@/components/SpendingChart";
import AddExpenseSheet from "@/components/AddExpenseSheet";
import ExpenseDetailSheet from "@/components/ExpenseDetailSheet";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { scopeOptionsFor } from "@/lib/settings";
import { getCycleRange, getCycleWeek, getCycleWeekIndex, getPreviousRange, getScopeRange, lastDayOf } from "@/lib/date-utils";
import { format } from "date-fns";
import { useCustomCategories, useExpenseMutations, useExpenses, useRecentExpenses } from "@/hooks/useExpenses";
import { displayNameOf, initialsOf, useProfile, useSettings } from "@/hooks/useProfile";
import { Link } from "react-router-dom";
import { splitByCurrency, sumAmounts } from "@/lib/currencies";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { settings } = useSettings();
  const { data: customCategories = [] } = useCustomCategories();
  const { data: recentExpenses = [], isLoading: loadingRecent } = useRecentExpenses(10);
  const { remove } = useExpenseMutations();

  const displayName = displayNameOf(profile, user?.email);
  const initials = initialsOf(profile, user?.email);
  const mainCurrency = settings.currency;
  const scopeOptions = scopeOptionsFor(settings);

  const handleEditClick = (expense: Expense) => {
    setExpenseToEdit(expense);
    setSelectedExpense(null); // Close Details Sheet
    setShowAdd(true); // Open Edit Sheet
  };

  const handleDelete = (id: string) => {
    remove.mutate(id, { onError: (err) => toast.error(err.message) });
  };

  // Current cycle and the matching week of the previous cycle (weekly pulse).
  const now = new Date();
  const cycle = getCycleRange(now, settings.cycleDay, scopeOptions.payday);
  const weekIndex = getCycleWeekIndex(cycle, now);
  const currentWeek = getCycleWeek(cycle, weekIndex);
  const prevWeek = getCycleWeek(getPreviousRange(cycle, "cycle", scopeOptions)!, weekIndex);

  // The Spending Circle follows the default view chosen in Profile.
  const chartRange = getScopeRange(settings.defaultScope, now, scopeOptions);

  const { data: cycleExpenses = [] } = useExpenses(cycle);
  const { data: currentWeekExpenses = [] } = useExpenses(currentWeek);
  const { data: prevWeekExpenses = [] } = useExpenses(prevWeek);
  const { data: chartExpenses = [] } = useExpenses(chartRange);

  const cycleSplit = splitByCurrency(cycleExpenses, mainCurrency);
  const cycleTotal = sumAmounts(cycleSplit.main);
  const currentWeekTotal = sumAmounts(splitByCurrency(currentWeekExpenses, mainCurrency).main);
  const prevWeekTotal = sumAmounts(splitByCurrency(prevWeekExpenses, mainCurrency).main);

  if (loadingProfile || loadingRecent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 px-8 pt-8 w-full max-w-7xl mx-auto overflow-x-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-8">
        <div>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            Welcome back <HandWaving size={16} className="text-yellow" weight="fill" />
          </p>
          <h2 className="font-display font-bold text-xl text-foreground">
            {displayName}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/profile" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-glass-border hover:border-primary/50 transition-colors">
            <StoredImage
              value={profile.avatar_url}
              alt="Profile"
              className="w-full h-full object-cover"
              fallback={<span className="text-[10px] font-bold text-primary">{initials}</span>}
            />
          </Link>
          <button onClick={() => signOut()} className="hidden md:flex w-9 h-9 rounded-full bg-muted items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
            <SignOut size={18} weight="bold" />
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Metrics Area */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <BalanceCard
            cycleTotal={cycleTotal}
            currentWeekTotal={currentWeekTotal}
            prevWeekTotal={prevWeekTotal}
            currency={mainCurrency}
            otherCurrencies={cycleSplit.others}
          />
          <SpendingChart
            expenses={chartExpenses}
            customCategories={customCategories}
            mainCurrency={mainCurrency}
            dateRange={settings.defaultScope === "all" ? "All Time" : `${format(chartRange.start, "MMM d")} - ${format(lastDayOf(chartRange), "MMM d")}`}
          />
        </div>

        {/* Side Rail Area */}
        <div className="flex flex-col gap-6">
          <div className="bg-card/40 backdrop-blur-xl border border-glass-border rounded-2xl p-6 shadow-xl shadow-black/5 flex flex-col h-full max-h-[600px]">
            <h3 className="font-display font-bold text-foreground mb-4 text-sm">Recent Transactions</h3>
            {recentExpenses.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center py-6">
                <p className="text-muted-foreground text-sm">No expenses yet. Tap + to add one!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto pr-2 scrollbar-none flex-1">
                {recentExpenses.map((exp, i) => (
                  <TransactionCard
                    key={exp.id}
                    expense={exp}
                    index={i}
                    onTap={setSelectedExpense}
                    customCategories={customCategories}
                    mainCurrency={mainCurrency}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <motion.button
        data-testid="add-expense"
        aria-label="Add expense"
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
        expense={expenseToEdit}
      />
      <ExpenseDetailSheet
        expense={selectedExpense}
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onDelete={handleDelete}
        onEdit={handleEditClick}
        customCategories={customCategories}
        mainCurrency={mainCurrency}
      />
    </div>
  );
};

export default Dashboard;
