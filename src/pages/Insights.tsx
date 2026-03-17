import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { getExpenses, DEFAULT_CATEGORIES, getCustomCategories, getCategoryInfo, Expense, CustomCategory } from "@/lib/expenses";
import { subMonths, format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import CategoryIcon from "@/components/CategoryIcon";
import ThemeToggle from "@/components/ThemeToggle";

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
  return expenses.filter((e) => isWithinInterval(new Date(e.date), { start, end }));
}

const Insights = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  useEffect(() => {
    Promise.all([getExpenses(), getCustomCategories()]).then(([exps, cats]) => {
      setExpenses(exps);
      setCustomCategories(cats);
    });
  }, []);

  const monthsData = [3, 2, 1, 0].map((ago) => {
    const exps = getMonthExpenses(expenses, ago);
    const total = exps.reduce((s, e) => s + Number(e.amount), 0);
    const label = format(subMonths(new Date(), ago), "MMM");
    return { label, total, current: ago === 0, ago };
  });

  const monthVariations = monthsData.map((m, i) => {
    if (i === 0) return { ...m, variation: null };
    const prev = monthsData[i - 1];
    if (prev.total === 0) return { ...m, variation: null };
    const pct = ((m.total - prev.total) / prev.total) * 100;
    return { ...m, variation: Math.round(pct) };
  });

  const months = monthVariations;
  const thisMonth = getMonthExpenses(expenses, 0);
  const lastMonth = getMonthExpenses(expenses, 1);

  const insight = useMemo(() => {
    if (thisMonth.length === 0 || lastMonth.length === 0) return null;
    const allCats = [...DEFAULT_CATEGORIES];
    let biggestDiff = -Infinity;
    let biggestCat = allCats[0];
    for (const cat of allCats) {
      const thisTotal = thisMonth.filter((e) => e.category === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      const lastTotal = lastMonth.filter((e) => e.category === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      if (lastTotal > 0) {
        const pct = ((thisTotal - lastTotal) / lastTotal) * 100;
        if (pct > biggestDiff) { biggestDiff = pct; biggestCat = cat; }
      }
    }
    if (biggestDiff <= 0) return null;
    return { cat: biggestCat, pct: Math.round(biggestDiff) };
  }, [thisMonth, lastMonth]);

  const categoryBreakdown = (() => {
    const catIds = new Set(thisMonth.map((e) => e.category));
    return Array.from(catIds).map((catId) => {
      const info = getCategoryInfo(catId, customCategories);
      const total = thisMonth.filter((e) => e.category === catId).reduce((s, e) => s + Number(e.amount), 0);
      return { ...info, total };
    }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  })();

  return (
    <div className="min-h-screen bg-background pb-28 px-4 pt-4 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-2xl text-foreground">Insights</h2>
        <ThemeToggle />
      </motion.div>

      {insight && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-3 mb-4 border-l-4 border-accent">
          <p className="text-foreground text-xs">
            This month you spent <span className="font-bold text-accent">{insight.pct}% more</span> on{" "}
            <CategoryIcon categoryId={insight.cat.id} size={14} className="inline-block align-text-bottom" /> {insight.cat.label} than last month!
          </p>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="glass-card p-4 mb-4">
        <h3 className="font-display font-bold text-foreground text-sm mb-3">Monthly Comparison</h3>
        {months.some((m) => m.total > 0) ? (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip cursor={false} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-card border border-glass-border rounded-xl px-3 py-1.5 text-xs shadow-xl">
                      <span className="font-medium text-foreground">{d.label}: ${d.total.toFixed(2)}</span>
                      {d.variation !== null && (
                        <span className={`ml-2 font-bold ${d.variation >= 0 ? 'text-destructive' : 'text-primary'}`}>
                          {d.variation >= 0 ? '+' : ''}{d.variation}%
                        </span>
                      )}
                    </div>
                  );
                }} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]} label={({ x, y, width, index }: any) => {
                  const entry = months[index];
                  if (entry.variation === null) return null;
                  const color = entry.variation >= 0 ? 'hsl(0, 72%, 60%)' : 'hsl(160, 60%, 60%)';
                  return (
                    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill={color}>
                      {entry.variation >= 0 ? '+' : ''}{entry.variation}%
                    </text>
                  );
                }}>
                  {months.map((entry, i) => (
                    <Cell key={i} fill={entry.current ? "hsl(160, 60%, 60%)" : "hsl(var(--muted))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-6">Add expenses to see your monthly trends</p>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="glass-card p-4">
        <h3 className="font-display font-bold text-foreground text-sm mb-3">This Month by Category</h3>
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
                    <span className="flex items-center gap-1.5">
                      <CategoryIcon categoryId={cat.id} customIcon={cat.icon} size={16} />
                      {cat.label}
                    </span>
                    <span className="font-medium text-foreground">${cat.total.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${GRADIENT_COLORS[cat.color]?.from ?? "#888"}, ${GRADIENT_COLORS[cat.color]?.to ?? "#666"})` }}
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
