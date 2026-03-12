import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Expense, CATEGORIES } from "@/lib/storage";
import CategoryExpensesSheet from "./CategoryExpensesSheet";
import CategoryIcon from "./CategoryIcon";
import { ChartDonut, ChartBar, TrendUp } from "@phosphor-icons/react";

type ChartType = "donut" | "bar" | "progress";

const GRADIENT_COLORS: Record<string, { from: string; to: string; solid: string }> = {
  mint: { from: "#4dd8a5", to: "#2ec4a0", solid: "hsl(160, 60%, 60%)" },
  teal: { from: "#4db8b0", to: "#3aa89e", solid: "hsl(180, 50%, 55%)" },
  lavender: { from: "#a78bfa", to: "#8b6fdb", solid: "hsl(260, 50%, 70%)" },
  electric: { from: "#5ba3f5", to: "#4a8ae8", solid: "hsl(210, 90%, 65%)" },
  pink: { from: "#f472b6", to: "#e05599", solid: "hsl(330, 70%, 70%)" },
  yellow: { from: "#fbbf24", to: "#f5a623", solid: "hsl(45, 90%, 65%)" },
  peach: { from: "#f4a574", to: "#e88d5a", solid: "hsl(25, 80%, 70%)" },
  coral: { from: "#ef7564", to: "#e05e4d", solid: "hsl(10, 75%, 65%)" },
};

interface SpendingChartProps {
  expenses: Expense[];
}

const SpendingChart = ({ expenses }: SpendingChartProps) => {
  const [chartType, setChartType] = useState<ChartType>("donut");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const grouped = CATEGORIES.map((cat) => {
    const total = expenses
      .filter((e) => e.category === cat.id)
      .reduce((sum, e) => sum + e.amount, 0);
    return { name: cat.label, value: total, color: cat.color, emoji: cat.emoji, id: cat.id };
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
  const maxValue = Math.max(...grouped.map((d) => d.value));

  const chartTypes: { key: ChartType; icon: React.ReactNode }[] = [
    { key: "donut", icon: <ChartDonut size={16} weight="duotone" /> },
    { key: "bar", icon: <ChartBar size={16} weight="duotone" /> },
    { key: "progress", icon: <TrendUp size={16} weight="duotone" /> },
  ];

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-6"
      >
        {/* Header with chart type switcher */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-foreground">Spending Circle</h3>
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
            {chartTypes.map((ct) => (
              <button
                key={ct.key}
                onClick={() => setChartType(ct.key)}
                className={`text-sm px-2.5 py-1 rounded-lg transition-all duration-200 ${
                  chartType === ct.key
                    ? "bg-primary/20 scale-105"
                    : "hover:bg-muted"
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {chartType === "donut" && (
            <motion.div
              key="donut"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-4"
            >
              <div className="w-36 h-36 shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {grouped.map((entry) => (
                        <linearGradient key={entry.color} id={`grad-${entry.color}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={GRADIENT_COLORS[entry.color]?.from} />
                          <stop offset="100%" stopColor={GRADIENT_COLORS[entry.color]?.to} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={grouped}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                      cursor="pointer"
                      onClick={(_, index) => handleCategoryClick(grouped[index].id)}
                    >
                      {grouped.map((entry, i) => (
                        <Cell key={i} fill={`url(#grad-${entry.color})`} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-muted-foreground">Total</span>
                  <span className="font-display font-bold text-sm text-foreground">${total.toFixed(0)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {grouped.map((d) => (
                  <button
                    key={d.name}
                    onClick={() => handleCategoryClick(d.id)}
                    className="flex items-center gap-2 text-sm hover:bg-muted/40 rounded-lg px-2 py-1 -mx-2 transition-colors text-left"
                  >
                    <CategoryIcon categoryId={d.id} size={16} />
                    <span className="text-foreground font-medium truncate">{d.name}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">
                      {((d.value / total) * 100).toFixed(0)}%
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {chartType === "bar" && (
            <motion.div
              key="bar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-48"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grouped} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <defs>
                    {grouped.map((entry) => (
                      <linearGradient key={entry.color} id={`bar-grad-${entry.color}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={GRADIENT_COLORS[entry.color]?.from} />
                        <stop offset="100%" stopColor={GRADIENT_COLORS[entry.color]?.to} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="emoji"
                    tick={{ fontSize: 16 }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-card border border-glass-border rounded-xl px-3 py-2 text-xs shadow-xl">
                          <span className="font-medium text-foreground">{d.name}: ${d.value.toFixed(2)}</span>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 8, 8, 0]}
                    cursor="pointer"
                    onClick={(data) => handleCategoryClick(data.id)}
                  >
                    {grouped.map((entry, i) => (
                      <Cell key={i} fill={`url(#bar-grad-${entry.color})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {chartType === "progress" && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {grouped.map((d) => {
                const pct = (d.value / maxValue) * 100;
                return (
                  <button
                    key={d.id}
                    onClick={() => handleCategoryClick(d.id)}
                    className="w-full text-left hover:bg-muted/20 rounded-xl p-1 -m-1 transition-colors"
                  >
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-2">
                        <CategoryIcon categoryId={d.id} size={16} />
                        <span className="font-medium text-foreground">{d.name}</span>
                      </span>
                      <span className="font-display font-bold text-foreground">${d.value.toFixed(2)}</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${GRADIENT_COLORS[d.color]?.from}, ${GRADIENT_COLORS[d.color]?.to})`,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <CategoryExpensesSheet
        open={selectedCategory !== null}
        onClose={() => setSelectedCategory(null)}
        categoryId={selectedCategory || ""}
        expenses={expenses}
      />
    </>
  );
};

export default SpendingChart;
