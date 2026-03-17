import { motion } from "framer-motion";
import { Trash } from "@phosphor-icons/react";
import { Expense, getCategoryInfo, CustomCategory } from "@/lib/expenses";
import { format } from "date-fns";
import CategoryIcon from "./CategoryIcon";

interface TransactionCardProps {
  expense: Expense;
  index: number;
  onDelete: (id: string) => void;
  customCategories: CustomCategory[];
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

const TransactionCard = ({ expense, index, onDelete, customCategories }: TransactionCardProps) => {
  const cat = getCategoryInfo(expense.category, customCategories);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 glass-card p-4 min-w-[260px] snap-start"
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
          colorMap[cat.color] ?? colorMap.mint
        }`}
      >
        <CategoryIcon categoryId={expense.category} customIcon={cat.icon} size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">
          {expense.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(expense.date), "MMM d, h:mm a")}
        </p>
      </div>
      <p className="font-display font-bold text-foreground text-sm shrink-0">
        -${Number(expense.amount).toFixed(2)}
      </p>
      <button
        onClick={() => onDelete(expense.id)}
        className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
      >
        <Trash size={14} weight="duotone" />
      </button>
    </motion.div>
  );
};

export default TransactionCard;
