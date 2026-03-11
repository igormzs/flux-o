import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Expense, CATEGORIES, getCategoryById } from "@/lib/storage";

const CHART_COLORS: Record<string, string> = {
  mint: "hsl(160, 60%, 60%)",
  teal: "hsl(180, 50%, 55%)",
  lavender: "hsl(260, 50%, 70%)",
  electric: "hsl(210, 90%, 65%)",
  pink: "hsl(330, 70%, 70%)",
  yellow: "hsl(45, 90%, 65%)",
  peach: "hsl(25, 80%, 70%)",
  coral: "hsl(10, 75%, 65%)",
};

interface SpendingChartProps {
  expenses: Expense[];
}

const SpendingChart = ({ expenses }: SpendingChartProps) => {
  const grouped = CATEGORIES.map((cat) => {
    const total = expenses
      .filter((e) => e.category === cat.id)
      .reduce((sum, e) => sum + e.amount, 0);
    return { name: cat.label, value: total, color: cat.color, emoji: cat.emoji };
  }).filter((d) => d.value > 0);

  if (grouped.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card p-6 text-center"
      >
        <p className="text-muted-foreground text-sm">No spending data yet. Add your first expense!</p>
      </motion.div>
    );
  }

  const total = grouped.reduce((s, d) => s + d.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-6"
    >
      <h3 className="font-display font-bold text-foreground mb-4">Spending Circle</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={grouped}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {grouped.map((entry, i) => (
                  <Cell key={i} fill={CHART_COLORS[entry.color]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {grouped.map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-sm">
              <span>{d.emoji}</span>
              <span className="text-foreground font-medium truncate">{d.name}</span>
              <span className="text-muted-foreground ml-auto shrink-0">
                {((d.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default SpendingChart;
