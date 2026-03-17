import { motion, AnimatePresence } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { Expense, getCategoryInfo, DEFAULT_CATEGORIES, CustomCategory } from "@/lib/expenses";
import { format } from "date-fns";
import CategoryIcon from "./CategoryIcon";

interface CategoryExpensesSheetProps {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  expenses: Expense[];
}

const CategoryExpensesSheet = ({ open, onClose, categoryId, expenses }: CategoryExpensesSheetProps) => {
  // We don't have customCategories passed here, use empty array for defaults
  const cat = getCategoryInfo(categoryId, []);
  const filtered = expenses.filter((e) => e.category === categoryId).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-card border-t border-glass-border rounded-t-3xl p-6 pb-10 max-h-[80vh] overflow-auto scrollbar-none"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <CategoryIcon categoryId={categoryId} customIcon={cat.icon} size={28} />
                <div>
                  <h2 className="font-display font-bold text-lg text-foreground">{cat.label}</h2>
                  <p className="text-sm text-muted-foreground">{filtered.length} expenses · ${total.toFixed(2)}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No expenses in this category</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((exp) => (
                  <motion.div
                    key={exp.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{exp.title || cat.label}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(exp.date), "MMM d, yyyy")}</p>
                    </div>
                    <span className="font-display font-bold text-foreground">-${Number(exp.amount).toFixed(2)}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CategoryExpensesSheet;
