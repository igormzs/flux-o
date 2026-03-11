import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { getExpenses, CATEGORIES, Expense } from "@/lib/storage";
import { subMonths, format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const GRADIENT_COLORS: Record<string, { from: string; to: string }> = {
  mint: { from: "#4dd8a5", to: "#2ec4a0" },
  teal: { from: "#4db8b0", to: "#3aa89e" },
  lavender: { from: "#a78bfa", to: "#8b6fdb" },
  electric: { from: "#5ba3f5", to: "#4a8ae8" },
  pink: { from: "#f472b6", to: "#e05599" },
  yellow: { from: "#fbbf24", to: "#f5a623" },
  peach: { from: "#f4a574", to: "#e88d5a" },
  coral: { from: "#ef7564", to: "#e05e4d" },
};

function getMonthExpenses(expenses: Expense[], monthsAgo: number) {
  const now = new Date();
  const target = subMonths(now, monthsAgo);
  const start = startOfMonth(target);
  const end = endOfMonth(target);
  return expenses.filter((e) =>
    isWithinInterval(new Date(e.date), { start, end })
  );
}

const Insights = () => {
  const expenses = useMemo(() => getExpenses(), []);

  const months = [3, 2, 1, 0].map((ago) => {
    const exps = getMonthExpenses(expenses, ago);
    const total = exps.reduce((s, e) => s + e.amount, 0);
    const label = format(subMonths(new Date(), ago), "MMM");
    return { label, total, current: ago === 0 };
  });

  const thisMonth = getMonthExpenses(expenses, 0);
  const lastMonth = getMonthExpenses(expenses, 1);

  // Find biggest increase category
  const insight = useMemo(() => {
    if (thisMonth.length === 0 || lastMonth.length === 0) return null;
    let biggestDiff = -Infinity;
    let biggestCat: typeof CATEGORIES[number] = CATEGORIES[0];
    for (const cat of CATEGORIES) {
      const thisTotal = thisMonth.filter((e) => e.category === cat.id).reduce((s, e) => s + e.amount, 0);
      const lastTotal = lastMonth.filter((e) => e.category === cat.id).reduce((s, e) => s + e.amount, 0);
      if (lastTotal > 0) {
        const pct = ((thisTotal - lastTotal) / lastTotal) * 100;
        if (pct > biggestDiff) {
          biggestDiff = pct;
          biggestCat = cat;
        }
      }
    }
    if (biggestDiff <= 0) return null;
    return { cat: biggestCat, pct: Math.round(biggestDiff) };
  }, [thisMonth, lastMonth]);

  const categoryBreakdown = CATEGORIES.map((cat) => ({
    ...cat,
    total: thisMonth.filter((e) => e.category === cat.id).reduce((s, e) => s + e.amount, 0),
  }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen bg-background pb-28 px-4 pt-6 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="font-display font-bold text-2xl text-foreground mb-6">Insights</h2>
      </motion.div>

      {/* Insight card */}
      {insight && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 mb-6 border-l-4 border-accent"
        >
          <p className="text-foreground text-sm">
            This month you spent{" "}
            <span className="font-bold text-accent">{insight.pct}% more</span> on{" "}
            {insight.cat.emoji} {insight.cat.label} than last month!
          </p>
        </motion.div>
      )}

      {/* Monthly comparison */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 mb-6"
      >
        <h3 className="font-display font-bold text-foreground mb-4">Monthly Comparison</h3>
        {months.some((m) => m.total > 0) ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(240, 5%, 55%)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {months.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.current ? "hsl(160, 60%, 60%)" : "hsl(240, 6%, 22%)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-6">
            Add expenses to see your monthly trends
          </p>
        )}
      </motion.div>

      {/* Category breakdown */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h3 className="font-display font-bold text-foreground mb-4">This Month by Category</h3>
        {categoryBreakdown.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">No data this month</p>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.map((cat) => {
              const max = categoryBreakdown[0].total;
              const pct = (cat.total / max) * 100;
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>
                      {cat.emoji} {cat.label}
                    </span>
                    <span className="font-medium text-foreground">${cat.total.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: CHART_COLORS[cat.color] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Insights;
