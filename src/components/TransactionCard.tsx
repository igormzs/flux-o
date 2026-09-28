import { motion } from "framer-motion";
import { Expense, CustomCategory } from "@/lib/expenses";
import { resolveCategory, categoryStyle } from "@/lib/categories";
import { format } from "date-fns";
import CategoryIcon from "./CategoryIcon";
import { expenseCurrency, formatMoney } from "@/lib/currencies";

interface TransactionCardProps {
  expense: Expense;
  index: number;
  onTap: (expense: Expense) => void;
  customCategories: CustomCategory[];
  mainCurrency: string;
}

const TransactionCard = ({ expense, index, onTap, customCategories, mainCurrency }: TransactionCardProps) => {
  const cat = resolveCategory(expense.category, customCategories);

  return (
    <motion.button
      data-testid="transaction-card"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onTap(expense)}
      className="flex items-center gap-3 glass-card p-4 min-w-[260px] snap-start text-left hover:bg-muted/30 hover:shadow-lg transition-all duration-200"
    >
      <div className="cat cat-soft w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={categoryStyle(cat.color)}>
        <CategoryIcon categoryId={expense.category} customIcon={cat.icon} size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{expense.title}</p>
        <p className="text-xs text-muted-foreground">{format(new Date(expense.date), "MMM d, h:mm a")}</p>
      </div>
      <p className="font-display font-bold text-foreground text-sm shrink-0">
        -{formatMoney(Number(expense.amount), expenseCurrency(expense, mainCurrency))}
      </p>
    </motion.button>
  );
};

export default TransactionCard;
