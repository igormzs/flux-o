import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CATEGORIES, saveExpense, CategoryId } from "@/lib/storage";
import CategoryIcon from "./CategoryIcon";

const colorBgMap: Record<string, string> = {
  mint: "bg-mint/20 border-mint/30 text-mint",
  teal: "bg-teal/20 border-teal/30 text-teal",
  lavender: "bg-lavender/20 border-lavender/30 text-lavender",
  electric: "bg-electric/20 border-electric/30 text-electric",
  pink: "bg-pink/20 border-pink/30 text-pink",
  yellow: "bg-yellow/20 border-yellow/30 text-yellow",
  peach: "bg-peach/20 border-peach/30 text-peach",
  coral: "bg-coral/20 border-coral/30 text-coral",
};

const selectedMap: Record<string, string> = {
  mint: "bg-mint text-primary-foreground",
  teal: "bg-teal text-primary-foreground",
  lavender: "bg-lavender text-primary-foreground",
  electric: "bg-electric text-primary-foreground",
  pink: "bg-pink text-primary-foreground",
  yellow: "bg-yellow text-primary-foreground",
  peach: "bg-peach text-primary-foreground",
  coral: "bg-coral text-primary-foreground",
};

interface AddExpenseSheetProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

const AddExpenseSheet = ({ open, onClose, onAdded }: AddExpenseSheetProps) => {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CategoryId | "">("");

  const handleSubmit = () => {
    if (!amount || !category) return;
    saveExpense({
      amount: parseFloat(amount),
      category,
      date: new Date().toISOString(),
    });
    setAmount("");
    setCategory("");
    onAdded();
    onClose();
  };

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
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-glass-border rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-bold text-xl text-foreground">Add Expense</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Amount input */}
            <div className="mb-6">
              <label className="text-sm text-muted-foreground mb-2 block">Amount</label>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-display font-bold text-muted-foreground">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-transparent text-4xl font-display font-bold text-foreground outline-none w-full placeholder:text-muted-foreground/30"
                  autoFocus
                />
              </div>
            </div>

            {/* Category grid */}
            <div className="mb-8">
              <label className="text-sm text-muted-foreground mb-3 block">Category</label>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-200 ${
                      category === cat.id
                        ? selectedMap[cat.color]
                        : colorBgMap[cat.color]
                    }`}
                  >
                    <CategoryIcon categoryId={cat.id} size={24} />
                    <span className="text-[10px] font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!amount || !category}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-lg disabled:opacity-30 transition-opacity"
            >
              Add Expense
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddExpenseSheet;
