import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { getExpenses, DEFAULT_CATEGORIES, getCustomCategories, getCategoryInfo, Expense, CustomCategory } from "@/lib/expenses";
import { subMonths, format, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from "date-fns";
import CategoryIcon from "@/components/CategoryIcon";
import ThemeToggle from "@/components/ThemeToggle";
import { getPeriodRange } from "@/lib/date-utils";
import { Link } from "react-router-dom";
import { ArrowLeft, User, CalendarBlank, TrendUp } from "@phosphor-icons/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCurrencySymbol } from "@/lib/currencies";
import InsightDetailsSheet from "@/components/InsightDetailsSheet";

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
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; username?: string; avatar_url?: string | null }>({});
  const [selectedDetail, setSelectedDetail] = useState<"day" | "week" | null>(null);

  useEffect(() => {
    Promise.all([getExpenses(), getCustomCategories()]).then(([exps, cats]) => {
      setExpenses(exps);
      setCustomCategories(cats);
    });

    if (user) {
      supabase.from("profiles").select("first_name, last_name, username, avatar_url").eq("id", user.id).single().then(({ data }) => {
        if (data) setProfile(data);
      });
    }
  }, [user]);

  const initials = profile.first_name && profile.last_name 
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : profile.first_name 
      ? profile.first_name.substring(0, 2).toUpperCase()
      : "IM";

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
  
  const settings = JSON.parse(localStorage.getItem("fluxo_settings") || "{}");
  const range = getPeriodRange(settings);
  const currencySymbol = getCurrencySymbol(settings.currency || "USD");
  
  const thisMonth = expenses.filter((e) => {
    try {
      return isWithinInterval(new Date(e.date), range);
    } catch (err) {
      return false;
    }
  });
  
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

  const busiestDayData = useMemo(() => {
    if (thisMonth.length === 0) return null;
    const dayGroups = Array(7).fill(0);
    thisMonth.forEach(e => {
      dayGroups[new Date(e.date).getDay()] += Number(e.amount);
    });
    const maxIdx = dayGroups.indexOf(Math.max(...dayGroups));
    if (dayGroups[maxIdx] === 0) return null;
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const allDays = DAYS.map((day, i) => ({ label: day, amount: dayGroups[i] })).filter(d => d.amount > 0).sort((a,b) => b.amount - a.amount);
    return { top: { day: DAYS[maxIdx], amount: dayGroups[maxIdx] }, all: allDays };
  }, [thisMonth]);

  const peakWeekData = useMemo(() => {
    if (thisMonth.length === 0) return null;
    const weeks: Record<number, number> = {};
    thisMonth.forEach(e => {
      const d = differenceInDays(new Date(e.date), range.start);
      const w = Math.floor(Math.max(0, d) / 7) + 1;
      weeks[w] = (weeks[w] || 0) + Number(e.amount);
    });
    const maxW = Object.keys(weeks).reduce((a, b) => weeks[Number(a)] > weeks[Number(b)] ? a : b, Object.keys(weeks)[0]);
    if (!maxW) return null;
    const allWeeks = Object.keys(weeks).map(w => ({ label: `Week ${w}`, amount: weeks[Number(w)] })).sort((a,b) => b.amount - a.amount);
    return { top: { week: maxW, amount: weeks[Number(maxW)] }, all: allWeeks };
  }, [thisMonth, range]);

  const weeklyComparisonData = useMemo(() => {
    if (!range.start || !range.end) return [];
    
    // Calculate total weeks in the current period range
    const daysInPeriod = differenceInDays(range.end, range.start);
    const totalWeeks = Math.max(1, Math.ceil(daysInPeriod / 7));
    
    const weeksTotal = Array(totalWeeks).fill(0);
    thisMonth.forEach(e => {
      const d = differenceInDays(new Date(e.date), range.start);
      const w = Math.floor(Math.max(0, d) / 7);
      if (w >= 0 && w < totalWeeks) {
        weeksTotal[w] += Number(e.amount);
      }
    });

    const now = new Date();
    const currentDayDiff = differenceInDays(now, range.start);
    const currentWeekIdx = Math.floor(currentDayDiff / 7);
    const isCurrentPeriod = isWithinInterval(now, range);

    return weeksTotal.map((total, i) => {
      const label = `W${i + 1}`;
      let variation = null;
      if (i > 0 && weeksTotal[i-1] > 0) {
        variation = Math.round(((total - weeksTotal[i-1]) / weeksTotal[i-1]) * 100);
      }
      return { 
        label, 
        total, 
        variation,
        current: i === currentWeekIdx && isCurrentPeriod
      };
    });
  }, [thisMonth, range]);

  const categoryBreakdown = (() => {
    const catIds = new Set(thisMonth.map((e) => e.category));
    return Array.from(catIds).map((catId) => {
      const info = getCategoryInfo(catId, customCategories);
      const total = thisMonth.filter((e) => e.category === catId).reduce((s, e) => s + Number(e.amount), 0);
      return { ...info, total };
    }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  })();

  return (
    <div className="min-h-screen bg-background pb-24 px-8 pt-8 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} weight="bold" />
          </Link>
          <h2 className="font-display font-bold text-2xl text-foreground">Insights</h2>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/profile" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-glass-border hover:border-primary/50 transition-colors">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-primary">{initials}</span>
            )}
          </Link>
        </div>
      </motion.div>

      {insight && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 mb-4">
          <p className="text-foreground text-sm">
            This month you spent <span className="font-bold text-accent">{insight.pct}% more</span> on{" "}
            <CategoryIcon categoryId={insight.cat.id} size={16} className="inline-block align-text-bottom" /> {insight.cat.label} than last month!
          </p>
        </motion.div>
      )}

      {(busiestDayData || peakWeekData) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 gap-3 mb-4">
          {peakWeekData && (
            <button onClick={() => setSelectedDetail("week")} className="glass-card p-4 flex flex-col justify-between text-left hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
                <TrendUp size={14} weight="bold" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Peak Week</span>
              </div>
              <div>
                <p className="font-display font-bold text-foreground">Week {peakWeekData.top.week}</p>
                <p className="text-xs text-muted-foreground">{currencySymbol}{peakWeekData.top.amount.toFixed(2)}</p>
              </div>
            </button>
          )}
          {busiestDayData && (
            <button onClick={() => setSelectedDetail("day")} className="glass-card p-4 flex flex-col justify-between text-left hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
                <CalendarBlank size={14} weight="bold" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Top Day</span>
              </div>
              <div>
                <p className="font-display font-bold text-foreground">{busiestDayData.top.day}</p>
                <p className="text-xs text-muted-foreground">{currencySymbol}{busiestDayData.top.amount.toFixed(2)}</p>
              </div>
            </button>
          )}
        </motion.div>
      )}

      {/* Weekly Comparison */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 }} className="glass-card p-4 mb-4">
        <h3 className="font-display font-bold text-foreground text-sm mb-3">Weekly Comparison</h3>
        {weeklyComparisonData.length > 0 && weeklyComparisonData.some(w => w.total > 0) ? (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyComparisonData}>
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip cursor={false} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-card border border-glass-border rounded-xl px-3 py-1.5 text-xs shadow-xl">
                      <span className="font-medium text-foreground">Week {d.label.replace('W', '')}: {currencySymbol}{d.total.toFixed(2)}</span>
                      {d.variation !== null && (
                        <span className={`ml-2 font-bold ${d.variation >= 0 ? 'text-destructive' : 'text-primary'}`}>
                          {d.variation >= 0 ? '+' : ''}{d.variation}%
                        </span>
                      )}
                    </div>
                  );
                }} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]} label={({ x, y, width, index }: { x: number; y: number; width: number; index: number }) => {
                  const entry = weeklyComparisonData[index];
                  if (entry.variation === null) return null;
                  const color = entry.variation >= 0 ? 'hsl(0, 72%, 60%)' : 'hsl(160, 60%, 60%)';
                  return (
                    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill={color}>
                      {entry.variation >= 0 ? '+' : ''}{entry.variation}%
                    </text>
                  );
                }}>
                  {weeklyComparisonData.map((entry, i) => (
                    <Cell key={i} fill={entry.current ? "hsl(160, 60%, 60%)" : "hsl(var(--muted))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-6">No weekly data in this period</p>
        )}
      </motion.div>

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
                      <span className="font-medium text-foreground">{d.label}: {currencySymbol}{d.total.toFixed(2)}</span>
                      {d.variation !== null && (
                        <span className={`ml-2 font-bold ${d.variation >= 0 ? 'text-destructive' : 'text-primary'}`}>
                          {d.variation >= 0 ? '+' : ''}{d.variation}%
                        </span>
                      )}
                    </div>
                  );
                }} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]} label={({ x, y, width, index }: { x: number; y: number; width: number; index: number }) => {
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-foreground text-sm">Period breakdown</h3>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {settings.periodType === 'all' ? 'All Time' : `${format(range.start, 'MMM d')} - ${format(range.end, 'MMM d')}`}
          </span>
        </div>
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
                    <span className="font-medium text-foreground">{currencySymbol}{cat.total.toFixed(2)}</span>
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

      <InsightDetailsSheet 
        open={selectedDetail !== null} 
        onClose={() => setSelectedDetail(null)} 
        title={selectedDetail === "week" ? "Spending by Week" : "Spending by Day"} 
        data={selectedDetail === "week" ? (peakWeekData?.all || []) : (busiestDayData?.all || [])} 
        currencySymbol={currencySymbol} 
      />
    </div>
  );
};

export default Insights;
