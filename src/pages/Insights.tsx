import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { DEFAULT_CATEGORIES, getCategoryInfo } from "@/lib/expenses";
import { subMonths, format, startOfMonth, differenceInDays } from "date-fns";
import CategoryIcon from "@/components/CategoryIcon";
import ThemeToggle from "@/components/ThemeToggle";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarBlank, TrendUp } from "@phosphor-icons/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCurrencySymbol } from "@/lib/currencies";
import InsightDetailsSheet from "@/components/InsightDetailsSheet";
import MonthPicker from "@/components/MonthPicker";
import { DateRangePicker } from "@/components/DateRangePicker";
import { useExpenses, useCustomCategories } from "@/hooks/useExpenses";
import { getSalaryCycleRange } from "@/lib/date-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

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

const Insights = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; username?: string; avatar_url?: string | null }>({});
  const [selectedDetail, setSelectedDetail] = useState<"day" | "week" | null>(null);

  const range = useMemo(() => {
    if (customRange?.from && customRange?.to) {
      return { start: customRange.from, end: customRange.to };
    }
    return getSalaryCycleRange(selectedMonth);
  }, [selectedMonth, customRange]);

  const prevRange = useMemo(() => {
    if (customRange) return null;
    return getSalaryCycleRange(subMonths(selectedMonth, 1));
  }, [selectedMonth, customRange]);

  const { data: expenses = [], isLoading: isLoadingExpenses } = useExpenses(range.start, range.end);
  const { data: prevExpenses = [] } = useExpenses(prevRange?.start || range.start, prevRange?.end || range.end);
  const { data: customCategories = [] } = useCustomCategories();

  useEffect(() => {
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

  const settings = JSON.parse(localStorage.getItem("fluxo_settings") || "{}");
  const currencySymbol = getCurrencySymbol(settings.currency || "USD");

  const totalThisMonth = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalPrevMonth = prevExpenses.reduce((s, e) => s + Number(e.amount), 0);
  
  const monthVariation = useMemo(() => {
    if (totalPrevMonth === 0) return null;
    return Math.round(((totalThisMonth - totalPrevMonth) / totalPrevMonth) * 100);
  }, [totalThisMonth, totalPrevMonth]);

  const insight = useMemo(() => {
    if (expenses.length === 0 || prevExpenses.length === 0) return null;
    const allCats = [...DEFAULT_CATEGORIES];
    let biggestDiff = -Infinity;
    let biggestCat = allCats[0];
    for (const cat of allCats) {
      const thisTotal = expenses.filter((e) => e.category === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      const lastTotal = prevExpenses.filter((e) => e.category === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      if (lastTotal > 0) {
        const pct = ((thisTotal - lastTotal) / lastTotal) * 100;
        if (pct > biggestDiff) { biggestDiff = pct; biggestCat = cat; }
      }
    }
    if (biggestDiff <= 0) return null;
    return { cat: biggestCat, pct: Math.round(biggestDiff) };
  }, [expenses, prevExpenses]);

  const busiestDayData = useMemo(() => {
    if (expenses.length === 0) return null;
    const dayGroups: Record<string, number> = {};
    expenses.forEach(e => {
      const day = format(new Date(e.date), "EEEE");
      dayGroups[day] = (dayGroups[day] || 0) + Number(e.amount);
    });
    const topDay = Object.keys(dayGroups).reduce((a, b) => dayGroups[a] > dayGroups[b] ? a : b);
    return { top: { day: topDay, amount: dayGroups[topDay] }, all: Object.entries(dayGroups).map(([label, amount]) => ({ label, amount })).sort((a,b) => b.amount - a.amount) };
  }, [expenses]);

  const peakWeekData = useMemo(() => {
    if (expenses.length === 0) return null;
    const weeks: Record<number, number> = {};
    expenses.forEach(e => {
      const d = differenceInDays(new Date(e.date), range.start);
      const w = Math.floor(Math.max(0, d) / 7) + 1;
      weeks[w] = (weeks[w] || 0) + Number(e.amount);
    });
    const maxW = Object.keys(weeks).reduce((a, b) => weeks[Number(a)] > weeks[Number(b)] ? a : b, Object.keys(weeks)[0]);
    return { top: { week: maxW, amount: weeks[Number(maxW)] }, all: Object.keys(weeks).map(w => ({ label: `Week ${w}`, amount: weeks[Number(w)] })).sort((a,b) => b.amount - a.amount) };
  }, [expenses, range]);

  const weeklyComparisonData = useMemo(() => {
    if (!range.start || !range.end) return [];
    const daysInPeriod = differenceInDays(range.end, range.start);
    const totalWeeks = Math.max(1, Math.ceil(daysInPeriod / 7));
    const weeksTotal = Array(totalWeeks).fill(0);
    expenses.forEach(e => {
      const d = differenceInDays(new Date(e.date), range.start);
      const w = Math.floor(Math.max(0, d) / 7);
      if (w >= 0 && w < totalWeeks) weeksTotal[w] += Number(e.amount);
    });
    return weeksTotal.map((total, i) => ({ label: `W${i + 1}`, total }));
  }, [expenses, range]);

  const categoryBreakdown = useMemo(() => {
    const catIds = new Set(expenses.map((e) => e.category));
    return Array.from(catIds).map((catId) => {
      const info = getCategoryInfo(catId, customCategories);
      const total = expenses.filter((e) => e.category === catId).reduce((s, e) => s + Number(e.amount), 0);
      return { ...info, total };
    }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  }, [expenses, customCategories]);


  return (
    <div className="min-h-screen bg-background pb-24 px-8 pt-8 max-w-lg mx-auto lg:max-w-6xl text-foreground transition-all duration-500">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-3">
          <Link to="/" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} weight="bold" />
          </Link>
          <h2 className="font-display font-bold text-2xl text-foreground">Insights</h2>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DateRangePicker date={customRange} onDateChange={setCustomRange} />
          <Link to="/profile" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-glass-border hover:border-primary/50 transition-colors">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-primary">{initials}</span>
            )}
          </Link>
        </div>
      </motion.div>

      <MonthPicker 
        selectedMonth={selectedMonth} 
        onMonthSelect={(m) => {
          setSelectedMonth(m);
          setCustomRange(undefined);
        }} 
        customRange={customRange}
      />

      <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
        {/* Main Column */}
        <div className="lg:col-span-7 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Spending</span>
              {monthVariation !== null && (
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold",
                  monthVariation <= 0 ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"
                )}>
                  {monthVariation <= 0 ? "↓" : "↑"} {Math.abs(monthVariation)}% vs last cycle
                </div>
              )}
            </div>
            {isLoadingExpenses ? (
              <Skeleton className="h-10 w-32 bg-muted/50" />
            ) : (
              <p className="font-display font-bold text-4xl text-foreground">
                {currencySymbol}{totalThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </motion.div>

          {/* Weekly Comparison */}
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 }} className="glass-card p-6">
            <h3 className="font-display font-bold text-foreground text-sm mb-6">Weekly Comparison</h3>
            {isLoadingExpenses ? (
              <div className="h-48 flex items-end gap-3 justify-around">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-[40%] w-10 bg-muted/30" />)}
              </div>
            ) : weeklyComparisonData.length > 0 && weeklyComparisonData.some(w => w.total > 0) ? (
              <div className="h-64">
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
                        </div>
                      );
                    }} />
                    <Bar 
                      dataKey="total" 
                      radius={[8, 8, 0, 0]} 
                      animationDuration={1000}
                    >
                      {weeklyComparisonData.map((entry, i) => (
                        <Cell 
                          key={i} 
                          fill={`url(#mint-gradient)`}
                        />
                      ))}
                    </Bar>
                    <defs>
                      <linearGradient id="mint-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GRADIENT_COLORS.mint.from} />
                        <stop offset="100%" stopColor={GRADIENT_COLORS.mint.to} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">No weekly data in this period</p>
            )}
          </motion.div>
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-5 space-y-6 mt-6 lg:mt-0">
          {insight && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-4 border-l-4 border-accent">
              <p className="text-foreground text-sm leading-relaxed">
                This period you spent <span className="font-bold text-accent">{insight.pct}% more</span> on{" "}
                <CategoryIcon categoryId={insight.cat.id} size={16} className="inline-block align-text-bottom" /> {insight.cat.label} than last cycle!
              </p>
            </motion.div>
          )}

          {(busiestDayData || peakWeekData) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 gap-3">
              {peakWeekData && (
                <button onClick={() => setSelectedDetail("week")} className="glass-card p-4 flex flex-col justify-between text-left hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
                    <TrendUp size={14} weight="bold" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Peak Week</span>
                  </div>
                  <div>
                    <p className="font-display font-bold text-lg text-foreground">W{peakWeekData.top.week}</p>
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
                    <p className="font-display font-bold text-lg text-foreground">{busiestDayData.top.day}</p>
                    <p className="text-xs text-muted-foreground">{currencySymbol}{busiestDayData.top.amount.toFixed(2)}</p>
                  </div>
                </button>
              )}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-foreground text-sm uppercase tracking-wider opacity-60">Category breakdown</h3>
            </div>
            {isLoadingExpenses ? (
              <div className="space-y-4 py-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-12" /></div>
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                ))}
              </div>
            ) : categoryBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No data this period</p>
            ) : (
              <div className="space-y-4">
                {categoryBreakdown.map((cat) => {
                  const max = categoryBreakdown[0].total;
                  const pct = (cat.total / max) * 100;
                  return (
                    <div key={cat.id} className="group">
                      <div className="flex items-center justify-between text-sm mb-1.5 group-hover:translate-x-1 transition-transform">
                        <span className="flex items-center gap-2">
                          <CategoryIcon categoryId={cat.id} customIcon={cat.icon} size={18} />
                          <span className="font-medium">{cat.label}</span>
                        </span>
                        <span className="font-bold text-foreground">{currencySymbol}{cat.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
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
      </div>

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
