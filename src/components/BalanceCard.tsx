import { motion } from "framer-motion";
import { TrendingDown } from "lucide-react";

interface BalanceCardProps {
  totalSpent: number;
  thisMonth: number;
}

const BalanceCard = ({ totalSpent, thisMonth }: BalanceCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card p-6"
    >
      <p className="text-muted-foreground text-sm font-medium mb-1">Total Spent</p>
      <h1 className="text-5xl font-display font-bold text-gradient-mint tracking-tight">
        ${totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </h1>
      <div className="flex items-center gap-2 mt-3">
        <div className="flex items-center gap-1 text-accent text-sm">
          <TrendingDown size={14} />
          <span className="font-medium">This month</span>
        </div>
        <span className="text-foreground font-semibold text-sm">
          ${thisMonth.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </motion.div>
  );
};

export default BalanceCard;
