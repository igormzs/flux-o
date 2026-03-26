import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarBlank, PencilSimple, Trash } from "@phosphor-icons/react";
import { format } from "date-fns";
import { Expense, CustomCategory, getCategoryInfo } from "@/lib/expenses";
import CategoryIcon from "./CategoryIcon";
import { getCurrencySymbol, parseNote } from "@/lib/currencies";

const colorMap: Record<string, string> = {
  mint: "bg-mint/15 text-mint",
  teal: "bg-teal/15 text-teal",
  lavender: "bg-lavender/15 text-lavender",
  electric: "bg-electric/15 text-electric",
  pink: "bg-pink/15 text-pink",
  yellow: "bg-yellow/15 text-yellow",
  peach: "bg-peach/15 text-peach",
  coral: "bg-coral/15 text-coral",
};

interface ExpenseDetailSheetProps {
  expense: Expense | null;
  open: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit: (expense: Expense) => void;
  customCategories: CustomCategory[];
}

const ExpenseDetailSheet = ({ expense, open, onClose, onDelete, onEdit, customCategories }: ExpenseDetailSheetProps) => {
  if (!expense) return null;
  const cat = getCategoryInfo(expense.category, customCategories);
  const { currency, note: cleanDescription } = parseNote(expense.note);
  const settings = JSON.parse(localStorage.getItem("fluxo_settings") || "{}");
  const displayCurrency = currency || settings.currency || "USD";
  const symbol = getCurrencySymbol(displayCurrency);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-glass-border rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-auto scrollbar-none max-w-xl mx-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-bold text-xl text-foreground">Expense Details</h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onEdit(expense)} 
                  className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                  title="Edit expense"
                >
                  <PencilSimple size={18} weight="bold" />
                </button>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <X size={16} weight="bold" />
                </button>
              </div>
            </div>

            {/* Category & Amount */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-3xl border border-glass-border">
                <CategoryIcon categoryId={expense.category} customIcon={cat.icon} size={32} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{cat.label}</p>
                <p className="text-4xl font-display font-bold text-foreground slashed-zero">
                  {symbol}{Number(expense.amount).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Info rows */}
            <div className="space-y-4 mb-6">
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Title</p>
                <p className="text-foreground font-medium">{expense.title}</p>
              </div>

              {cleanDescription && (
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground text-sm">{cleanDescription}</p>
                </div>
              )}

              <div className="glass-card p-4 flex items-center gap-3">
                <CalendarBlank size={18} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-foreground text-sm font-medium">
                    {format(new Date(expense.date), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>

              {expense.image_url && (
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground mb-2">Receipt</p>
                  <img
                    src={expense.image_url}
                    alt="Expense receipt"
                    className="w-full rounded-xl object-cover max-h-48"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <button
              onClick={() => { onDelete(expense.id); onClose(); }}
              className="w-full py-3.5 rounded-2xl bg-destructive/10 text-destructive font-display font-bold text-sm flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors"
            >
              <Trash size={18} weight="bold" />
              Delete Expense
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ExpenseDetailSheet;
