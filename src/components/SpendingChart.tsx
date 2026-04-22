import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { DEFAULT_CATEGORIES, CustomCategory, getCategoryInfo } from "@/lib/expenses";
import type { Expense } from "@/lib/expenses";
import CategoryExpensesSheet from "./CategoryExpensesSheet";
import CategoryIcon from "./CategoryIcon";
import { ChartDonut, ChartBar, TrendUp } from "@phosphor-icons/react";
import { getCurrencySymbol } from "@/lib/currencies";

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
  customCategories: CustomCategory[];
  dateRange?: string;
}

const SpendingChart = ({ expenses, customCategories, dateRange }: SpendingChartProps) => {
  const [chartType, setChartType] = useState<ChartType>("donut");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const settings = JSON.parse(localStorage.getItem("fluxo_settings") || "{}");
  const currencySymbol = getCurrencySymbol(settings.currency || "USD");

  // Group by category
  const categoryIds = new Set(expenses.map((e) => e.category));
  const grouped = Array.from(categoryIds).map((catId) => {
    const total = expenses.filter((e) => e.category === catId).reduce((sum, e) => sum + Number(e.amount), 0);
    const info = getCategoryInfo(catId, customCategories);
    return { name: info.label, value: total, color: info.color, id: catId, icon: info.icon };
  }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);

  if (grouped.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 text-center">
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

  const handleCategoryClick = (categoryId: string) => setSelectedCategory(categoryId);

  const donutChartContent = (
    <div className="flex flex-col lg:flex-row items-center gap-8 w-full">
      <div className="w-52 h-52 shrink-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {grouped.map((entry) => (
                <linearGradient key={entry.color} id={`grad-${entry.color}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={GRADIENT_COLORS[entry.color]?.from ?? "#888"} />
                  <stop offset="100%" stopColor={GRADIENT_COLORS[entry.color]?.to ?? "#666"} />
                </linearGradient>
              ))}
            </defs>
            <Pie data={grouped} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0} cursor="pointer" onClick={(_, index) => handleCategoryClick(grouped[index].id)}>
              {grouped.map((entry, i) => (
                <Cell key={i} fill={`url(#grad-${entry.color})`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Total</span>
          <span className="font-display font-bold text-xl text-foreground leading-none">{currencySymbol}{total.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
        </div>
      </div>
      {!isMobile && (
        <div className="hidden lg:flex flex-col gap-4 flex-1 w-full min-w-0">
          {grouped.map((d) => (
            <div key={d.id} className="flex flex-col gap-1.5">
              <button onClick={() => handleCategoryClick(d.id)} className="flex items-center justify-between text-sm hover:opacity-70 transition-opacity w-full text-left">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon categoryId={d.id} customIcon={d.icon} size={16} />
                  <span className="text-foreground font-medium truncate">{d.name}</span>
                </div>
                <span className="text-muted-foreground ml-auto shrink-0 text-[10px] font-bold">
                  {((d.value / total) * 100).toFixed(0)}%
                </span>
              </button>
              <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${(d.value / total) * 100}%` }} 
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full" 
                  style={{ background: `linear-gradient(90deg, ${GRADIENT_COLORS[d.color]?.from ?? "#888"}, ${GRADIENT_COLORS[d.color]?.to ?? "#666"})` }} 
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const barChartContent = (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={grouped} layout="vertical" margin={{ left: 0, right: 8 }}>
          <defs>
            {grouped.map((entry) => (
              <linearGradient key={entry.color} id={`bar-grad-${entry.color}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={GRADIENT_COLORS[entry.color]?.from ?? "#888"} />
                <stop offset="100%" stopColor={GRADIENT_COLORS[entry.color]?.to ?? "#666"} />
              </linearGradient>
            ))}
          </defs>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(240, 5%, 55%)" }} axisLine={false} tickLine={false} width={80} />
          <Tooltip cursor={false} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-card border border-glass-border rounded-xl px-3 py-2 text-xs shadow-xl">
                <span className="font-medium text-foreground">{d.name}: {currencySymbol}{d.value.toFixed(2)}</span>
              </div>
            );
          }} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} cursor="pointer" onClick={(data) => handleCategoryClick(data.id)}>
            {grouped.map((entry, i) => (
              <Cell key={i} fill={`url(#bar-grad-${entry.color})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const progressChartContent = (
    <div className="space-y-3">
      {grouped.map((d) => {
        const pct = (d.value / maxValue) * 100;
        return (
          <button key={d.id} onClick={() => handleCategoryClick(d.id)} className="w-full text-left hover:bg-muted/20 rounded-xl p-1 -m-1 transition-colors">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="flex items-center gap-2">
                <CategoryIcon categoryId={d.id} customIcon={d.icon} size={16} />
                <span className="font-medium text-foreground">{d.name}</span>
              </span>
              <span className="font-display font-bold text-foreground">{currencySymbol}{d.value.toFixed(2)}</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.1 }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${GRADIENT_COLORS[d.color]?.from ?? "#888"}, ${GRADIENT_COLORS[d.color]?.to ?? "#666"})` }} />
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <h3 className="font-display font-bold text-foreground">Spending Circle</h3>
            {dateRange && <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">{dateRange}</p>}
          </div>
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1 relative z-10">
            {chartTypes.map((ct) => (
              <button 
                key={ct.key} 
                onClick={() => setChartType(ct.key)} 
                className={`text-sm px-2.5 py-1 rounded-lg transition-all duration-200 ${chartType === ct.key ? "bg-primary/20 scale-105 text-primary" : "hover:bg-muted text-muted-foreground"}`}
              >
                {ct.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Content View (Shared logic for mobile/desktop tabs) */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            {chartType === "donut" && (
              <motion.div key="donut" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {donutChartContent}
              </motion.div>
            )}
            {chartType === "bar" && (
              <motion.div key="bar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {barChartContent}
              </motion.div>
            )}
            {chartType === "progress" && (
              <motion.div key="progress" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {progressChartContent}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <CategoryExpensesSheet
        open={selectedCategory !== null}
        onClose={() => setSelectedCategory(null)}
        categoryId={selectedCategory || ""}
        expenses={expenses}
        customCategories={customCategories}
      />
    </>
  );
};

export default SpendingChart;
