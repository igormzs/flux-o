import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { resolveCategory, gradientStops } from "@/lib/categories";
import { format, startOfMonth, differenceInCalendarDays } from "date-fns";
import CategoryIcon from "@/components/CategoryIcon";
import ThemeToggle from "@/components/ThemeToggle";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarBlank, TrendUp, TrendDown, ChartLineUp } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { getCurrencySymbol, formatMoney, splitByCurrency, sumAmounts } from "@/lib/currencies";
import InsightDetailsSheet from "@/components/InsightDetailsSheet";
import OtherCurrenciesNote from "@/components/OtherCurrenciesNote";
import MonthPicker from "@/components/MonthPicker";
import { DateRangePicker } from "@/components/DateRangePicker";
import { useExpenses, useCustomCategories } from "@/hooks/useExpenses";
import { initialsOf, useProfile, useSettings } from "@/hooks/useProfile";
import { countWeeks, getCycleRange, getPreviousRange, rangeFromDays } from "@/lib/date-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange as DayPickerRange } from "react-day-picker";
import { cn } from "@/lib/utils";

const gradientCss = (color: string) => {
  const { from, to } = gradientStops(color);
  return `linear-gradient(90deg, ${from}, ${to})`;
};

const Insights = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [customRange, setCustomRange] = useState<DayPickerRange | undefined>();
  const [selectedDetail, setSelectedDetail] = useState<"day" | "week" | null>(null);
  const { data: profile } = useProfile();
  const { settings } = useSettings();
  const mainCurrency = settings.currency;
  const currencySymbol = getCurrencySymbol(mainCurrency);

  const isCustom = !!(customRange?.from && customRange?.to);
  // A month chip means the cycle that contains the 1st of that month
  // (for a cycle day of 25, "September" is Aug 25 – Sep 24).
  const range = useMemo(() => {
    if (customRange?.from && customRange?.to) return rangeFromDays(customRange.from, customRange.to);
    return getCycleRange(selectedMonth, settings.cycleDay);
  }, [selectedMonth, customRange, settings.cycleDay]);

  const prevRange = useMemo(
    () => getPreviousRange(range, isCustom ? "custom" : "cycle", { cycleDay: settings.cycleDay }),
    [range, isCustom, settings.cycleDay],
  );

  const { data: allExpenses = [], isLoading: isLoadingExpenses } = useExpenses(range);
  const { data: allPrevExpenses = [] } = useExpenses(prevRange);
  const { data: customCategories = [] } = useCustomCategories();

  const initials = initialsOf(profile, user?.email);

  // Totals and charts only add up the main currency; others are listed apart.
  const { main: expenses, others: otherCurrencies } = useMemo(() => splitByCurrency(allExpenses, mainCurrency), [allExpenses, mainCurrency]);
  const prevExpenses = useMemo(() => splitByCurrency(allPrevExpenses, mainCurrency).main, [allPrevExpenses, mainCurrency]);

  const totalThisMonth = sumAmounts(expenses);
  const totalPrevMonth = sumAmounts(prevExpenses);

  const monthVariation = useMemo(() => {
    if (totalPrevMonth === 0) return null;
    return Math.round(((totalThisMonth - totalPrevMonth) / totalPrevMonth) * 100);
  }, [totalThisMonth, totalPrevMonth]);

  // Biggest category increase vs the previous period, including custom categories
  // (v1 only looked at the 8 built-in ones).
  const insight = useMemo(() => {
    if (expenses.length === 0 || prevExpenses.length === 0) return null;
    const catIds = new Set([...expenses, ...prevExpenses].map((e) => e.category));
    let biggest: { id: string; pct: number } | null = null;
    for (const id of catIds) {
      const thisTotal = sumAmounts(expenses.filter((e) => e.category === id));
      const lastTotal = sumAmounts(prevExpenses.filter((e) => e.category === id));
      if (lastTotal > 0) {
        const pct = ((thisTotal - lastTotal) / lastTotal) * 100;
        if (!biggest || pct > biggest.pct) biggest = { id, pct };
      }
    }
    if (!biggest || biggest.pct <= 0) return null;
    return { cat: resolveCategory(biggest.id, customCategories), pct: Math.round(biggest.pct) };
  }, [expenses, prevExpenses, customCategories]);

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
      const d = differenceInCalendarDays(new Date(e.date), range.start);
      const w = Math.floor(Math.max(0, d) / 7) + 1;
      weeks[w] = (weeks[w] || 0) + Number(e.amount);
    });
    const maxW = Object.keys(weeks).reduce((a, b) => weeks[Number(a)] > weeks[Number(b)] ? a : b, Object.keys(weeks)[0]);
    return { top: { week: maxW, amount: weeks[Number(maxW)] }, all: Object.keys(weeks).map(w => ({ label: `Week ${w}`, amount: weeks[Number(w)] })).sort((a,b) => b.amount - a.amount) };
  }, [expenses, range]);

  const weeklyComparisonData = useMemo(() => {
    const totalWeeks = countWeeks(range);
    const weeksTotal = Array(totalWeeks).fill(0);
    expenses.forEach(e => {
      const d = differenceInCalendarDays(new Date(e.date), range.start);
      const w = Math.floor(Math.max(0, d) / 7);
      if (w >= 0 && w < totalWeeks) weeksTotal[w] += Number(e.amount);
    });
    return weeksTotal.map((total, i) => ({ label: `W${i + 1}`, total }));
  }, [expenses, range]);

  const categoryBreakdown = useMemo(() => {
    const catIds = new Set(expenses.map((e) => e.category));
    return Array.from(catIds).map((catId) => {
      const info = resolveCategory(catId, customCategories);
      const total = sumAmounts(expenses.filter((e) => e.category === catId));
      return { ...info, total };
    }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  }, [expenses, customCategories]);

  const mintGradient = gradientStops("mint");

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
            {profile?.avatar_url ? (
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
            className="glass-card p-6 md:p-8"
          >
            <div className="flex flex-col gap-6">
              <div>
                <span className="text-muted-foreground text-xs font-bold uppercase tracking-[0.1em] mb-2 font-body block">Total Spending</span>
                {isLoadingExpenses ? (
                  <Skeleton className="h-12 w-48 bg-muted/50" />
                ) : (
                  <>
                    <h1 className="font-display font-bold text-5xl md:text-6xl text-foreground tracking-tight">
                      {formatMoney(totalThisMonth, mainCurrency)}
                    </h1>
                    <OtherCurrenciesNote totals={otherCurrencies} className="mt-2" />
                  </>
                )}
              </div>

              <div className="pt-6 border-t border-glass-border/50">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ChartLineUp size={20} weight="bold" className="text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider font-body">Pulse Indicator</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {monthVariation !== null && (
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl font-display font-bold text-sm transition-colors",
                        monthVariation <= 0 ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"
                      )}>
                        {monthVariation <= 0 ? <TrendDown size={16} weight="bold" /> : <TrendUp size={16} weight="bold" />}
                        {Math.abs(monthVariation)}%
                      </div>
                    )}
                    
                    <div className="flex flex-col justify-center">
                      <span className="text-foreground font-bold font-display text-lg leading-tight">
                        {totalThisMonth >= totalPrevMonth ? "+" : "-"}{formatMoney(Math.abs(totalThisMonth - totalPrevMonth), mainCurrency)}
                      </span>
                      <span className="text-muted-foreground text-[10px] font-medium font-body uppercase tracking-tight">
                        vs. previous period
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
                        <stop offset="0%" stopColor={mintGradient.from} />
                        <stop offset="100%" stopColor={mintGradient.to} />
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
                <CategoryIcon categoryId={insight.cat.id} customIcon={insight.cat.icon} size={16} className="inline-block align-text-bottom" /> {insight.cat.label} than last cycle!
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
                        <span className="font-bold text-foreground">{formatMoney(cat.total, mainCurrency)}</span>
                      </div>
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                          className="h-full rounded-full"
                          style={{ background: gradientCss(cat.color) }}
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
