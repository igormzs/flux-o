import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { getExpenses, deleteExpense, Expense } from "@/lib/storage";
import BalanceCard from "@/components/BalanceCard";
import TransactionCard from "@/components/TransactionCard";
import SpendingChart from "@/components/SpendingChart";
import AddExpenseSheet from "@/components/AddExpenseSheet";

const Dashboard = () => {
  const [expenses, setExpenses] = useState<Expense[]>(getExpenses);
  const [showAdd, setShowAdd] = useState(false);

  const refresh = useCallback(() => setExpenses(getExpenses()), []);

  const handleDelete = (id: string) => {
    deleteExpense(id);
    refresh();
  };

  const now = new Date();
  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-background pb-28 px-4 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <p className="text-muted-foreground text-sm">Welcome back 👋</p>
          <h2 className="font-display font-bold text-xl text-foreground">Fluxo</h2>
        </div>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-mint to-lavender" />
      </motion.div>

      {/* Balance */}
      <div className="mb-6">
        <BalanceCard totalSpent={totalSpent} thisMonth={thisMonth} />
      </div>

      {/* Spending Chart */}
      <div className="mb-6">
        <SpendingChart expenses={thisMonthExpenses} />
      </div>

      {/* Recent Transactions */}
      <div className="mb-6">
        <h3 className="font-display font-bold text-foreground mb-3">Recent</h3>
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
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center z-40"
      >
        <Plus size={24} strokeWidth={2.5} />
      </motion.button>

      <AddExpenseSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={refresh}
      />
    </div>
  );
};

export default Dashboard;
