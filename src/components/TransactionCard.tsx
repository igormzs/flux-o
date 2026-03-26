import { motion } from "framer-motion";
import { Expense, getCategoryInfo, CustomCategory } from "@/lib/expenses";
import { format } from "date-fns";
import CategoryIcon from "./CategoryIcon";
import { getCurrencySymbol, parseNote } from "@/lib/currencies";

interface TransactionCardProps {
  expense: Expense;
  index: number;
  onTap: (expense: Expense) => void;
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

const TransactionCard = ({ expense, index, onTap, customCategories }: TransactionCardProps) => {
  const cat = getCategoryInfo(expense.category, customCategories);
  const { currency } = parseNote(expense.note);
  const settings = JSON.parse(localStorage.getItem("fluxo_settings") || "{}");
  const displayCurrency = currency || settings.currency || "USD";
  const symbol = getCurrencySymbol(displayCurrency);

  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onTap(expense)}
      className="flex items-center gap-3 glass-card p-4 min-w-[260px] snap-start text-left hover:bg-muted/30 hover:shadow-lg transition-all duration-200"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${colorMap[cat.color] ?? colorMap.mint}`}>
        <CategoryIcon categoryId={expense.category} customIcon={cat.icon} size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{expense.title}</p>
        <p className="text-xs text-muted-foreground">{format(new Date(expense.date), "MMM d, h:mm a")}</p>
      </div>
      <p className="font-display font-bold text-foreground text-sm shrink-0">
        -{symbol}{Number(expense.amount).toFixed(2)}
      </p>
    </motion.button>
  );
};

export default TransactionCard;
