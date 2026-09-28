import { motion } from "framer-motion";
import { ChartLineUp, TrendUp, TrendDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/currencies";
import OtherCurrenciesNote from "./OtherCurrenciesNote";

interface BalanceCardProps {
  cycleTotal: number;
  currentWeekTotal: number;
  prevWeekTotal: number;
  currency: string;
  /** Totals in currencies other than `currency`, shown separately. */
  otherCurrencies?: Record<string, number>;
}

const BalanceCard = ({ cycleTotal, currentWeekTotal, prevWeekTotal, currency, otherCurrencies = {} }: BalanceCardProps) => {
  const diff = currentWeekTotal - prevWeekTotal;
  const isSpendingLower = diff <= 0;
  const percentage = prevWeekTotal > 0 
    ? Math.abs(Math.round((diff / prevWeekTotal) * 100))
    : diff > 0 ? 100 : 0; // If prev was 0 and current > 0, show 100% (or simple placeholder)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden glass-card p-6 md:p-8 shadow-xl shadow-black/5"
    >
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-mint/20 rounded-full blur-3xl opacity-60"></div>
      <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-lavender/20 rounded-full blur-3xl opacity-60"></div>
      
      <div className="relative z-10 flex flex-col gap-6">
        <div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.1em] mb-2 font-body">
            Total Spending
          </p>
          <h1 className="text-5xl md:text-6xl font-display font-bold text-foreground tracking-tight">
            {formatMoney(cycleTotal, currency)}
          </h1>
          <OtherCurrenciesNote totals={otherCurrencies} className="mt-2" />
        </div>

        <div className="pt-6 border-t border-glass-border/50">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ChartLineUp size={20} weight="bold" className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider font-body">Weekly Pulse</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl font-display font-bold text-sm transition-colors",
                isSpendingLower ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"
              )}>
                {isSpendingLower ? <TrendDown size={16} weight="bold" /> : <TrendUp size={16} weight="bold" />}
                {percentage}%
              </div>
              
              <div className="flex flex-col justify-center">
                <span className="text-foreground font-bold font-display text-lg leading-tight">
                  {diff > 0 ? "+" : "-"}{formatMoney(Math.abs(diff), currency)}
                </span>
                <span className="text-muted-foreground text-[10px] font-medium font-body">
                  vs. same week last cycle
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BalanceCard;
