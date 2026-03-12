import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Expense, getCategoryById } from "@/lib/storage";
import { format } from "date-fns";
import CategoryIcon from "./CategoryIcon";

interface TransactionCardProps {
  expense: Expense;
  index: number;
  onDelete: (id: string) => void;
}

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

const TransactionCard = ({ expense, index, onDelete }: TransactionCardProps) => {
  const cat = getCategoryById(expense.category);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 glass-card p-4 min-w-[260px] snap-start"
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
          colorMap[cat?.color ?? "mint"]
        }`}
      >
        <CategoryIcon categoryId={expense.category} size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">
          {cat?.label ?? expense.category}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(expense.date), "MMM d, h:mm a")}
        </p>
      </div>
      <p className="font-display font-bold text-foreground text-sm shrink-0">
        -${expense.amount.toFixed(2)}
      </p>
      <button
        onClick={() => onDelete(expense.id)}
        className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </motion.div>
  );
};

export default TransactionCard;
