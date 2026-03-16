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
      className="glass-card p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-medium mb-0.5">Total Spent</p>
          <h1 className="text-3xl font-display font-bold text-gradient-mint tracking-tight">
            ${totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </h1>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-accent text-xs">
            <TrendingDown size={12} />
            <span className="font-medium">This month</span>
          </div>
          <span className="text-foreground font-semibold text-sm">
            ${thisMonth.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default BalanceCard;
