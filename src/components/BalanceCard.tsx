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
  /** The budget goal for the cycle; 0 hides the budget bar. */
  budgetGoal?: number;
  /** Recurring expenses not confirmed yet this cycle. */
  toCome?: number;
}

/** Spending against the goal, with recurring expenses still to come shown as a lighter segment. */
const BudgetBar = ({ spent, goal, toCome, currency }: { spent: number; goal: number; toCome: number; currency: string }) => {
  const over = spent > goal;
  const willGoOver = !over && spent + toCome > goal;
  const scale = Math.max(goal, spent + toCome);
  const pct = (n: number) => `${(n / scale) * 100}%`;
  return (
    <div className="mt-5" data-testid="budget-bar">
      <div
        role="progressbar"
        aria-label="Budget used"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.round(Math.min(spent, goal))}
        className="relative h-2 rounded-full bg-muted overflow-hidden flex"
      >
        <div style={{ width: pct(spent) }} className={over ? "bg-coral" : "bg-primary"} />
        <div style={{ width: pct(toCome) }} className={over || willGoOver ? "bg-coral/40" : "bg-primary/35"} />
        {scale > goal && <div style={{ left: pct(goal) }} className="absolute inset-y-0 w-0.5 bg-foreground/70" aria-hidden />}
      </div>
      <p className={cn("text-xs mt-2 font-body", over ? "text-coral font-medium" : "text-muted-foreground")}>
        {over
          ? `${formatMoney(spent - goal, currency)} over your ${formatMoney(goal, currency)} goal`
          : `${formatMoney(goal - spent, currency)} left of your ${formatMoney(goal, currency)} goal`}
        {toCome > 0 && ` · ${formatMoney(toCome, currency)} recurring to come`}
      </p>
      {willGoOver && (
        <p className="text-xs mt-1 font-body font-medium text-coral">
          On track to go {formatMoney(spent + toCome - goal, currency)} over
        </p>
      )}
    </div>
  );
};

const BalanceCard = ({ cycleTotal, currentWeekTotal, prevWeekTotal, currency, otherCurrencies = {}, budgetGoal = 0, toCome = 0 }: BalanceCardProps) => {
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
          {budgetGoal > 0 && <BudgetBar spent={cycleTotal} goal={budgetGoal} toCome={toCome} currency={currency} />}
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
