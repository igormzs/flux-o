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
      className="relative overflow-hidden bg-card/60 backdrop-blur-xl border border-glass-border rounded-2xl p-6 md:p-8 shadow-xl shadow-black/5"
    >
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-mint/20 rounded-full blur-3xl opacity-60"></div>
      <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-lavender/20 rounded-full blur-3xl opacity-60"></div>
      
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm font-medium mb-1">Total Spent</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient-mint tracking-tight">
            ${totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </h1>
        </div>
        <div className="md:text-right border-t border-glass-border md:border-none pt-4 md:pt-0">
          <div className="flex items-center md:justify-end gap-1.5 text-accent text-sm mb-1">
            <TrendingDown size={16} />
            <span className="font-medium">This month</span>
          </div>
          <span className="text-foreground font-semibold text-lg md:text-xl">
            ${thisMonth.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default BalanceCard;
