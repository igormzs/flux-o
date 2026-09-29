import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { format, subDays } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarBlank, TrendUp, TrendDown, ChartLineUp, Clock, CalendarCheck } from "@phosphor-icons/react";
import { DateRange as DayPickerRange } from "react-day-picker";
import CategoryIcon from "@/components/CategoryIcon";
import ThemeToggle from "@/components/ThemeToggle";
import InsightDetailsSheet from "@/components/InsightDetailsSheet";
import OtherCurrenciesNote from "@/components/OtherCurrenciesNote";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PeriodChips, ScopeTabs } from "@/components/insights/PeriodPicker";
import HistoryChart, { type HistoryBar } from "@/components/insights/HistoryChart";
import PaydaySheet from "@/components/insights/PaydaySheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses, useCustomCategories } from "@/hooks/useExpenses";
import { initialsOf, useProfile, useSettings } from "@/hooks/useProfile";
import { resolveCategory, gradientStops } from "@/lib/categories";
import { formatMoney, getCurrencySymbol, splitByCurrency } from "@/lib/currencies";
import { cycleKey, getRecentRanges, getScopeRange, isInRange, lastDayOf, nominalStartOfCycle, rangeFromDays, type DateRange } from "@/lib/date-utils";
import {
  BUCKET_NOUN,
  categoryComparison,
  comparePeriods,
  HISTORY_LENGTH,
  history,
  INSIGHT_SCOPES,
  periodLabel,
  periodNoun,
  sumIn,
  timeBuckets,
  type BaselineMode,
  type InsightScope,
} from "@/lib/insights";
import { scopeOptionsFor } from "@/lib/settings";
import { cn } from "@/lib/utils";

const gradientCss = (color: string) => {
  const { from, to } = gradientStops(color);
  return `linear-gradient(90deg, ${from}, ${to})`;
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const parseDay = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : null);
const sameStart = (a: DateRange, b: DateRange) => a.start.getTime() === b.start.getTime();

const Insights = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { settings } = useSettings();
  const { data: customCategories = [] } = useCustomCategories();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<BaselineMode>("previous");
  const [selectedDetail, setSelectedDetail] = useState<"bucket" | "day" | null>(null);
  const [paydayOpen, setPaydayOpen] = useState(false);

  const now = new Date();
  const mainCurrency = settings.currency;
  const opts = scopeOptionsFor(settings);

  // The view lives in the URL (?scope=month&at=2026-08-01), so Back and bookmarks work.
  const fromDefault = (["cycle", "month", "week"] as const).find((s) => s === settings.defaultScope) ?? "cycle";
  const scopeParam = params.get("scope");
  const scope: InsightScope = INSIGHT_SCOPES.some((s) => s.id === scopeParam) ? (scopeParam as InsightScope) : fromDefault;
  const at = parseDay(params.get("at")) ?? now;
  const customRange = rangeFromDays(parseDay(params.get("from")) ?? subDays(now, 29), parseDay(params.get("to")) ?? now);
  const scopeOpts = { ...opts, custom: customRange };
  const noun = periodNoun(scope);

  const range = scope === "custom" ? customRange : getScopeRange(scope, at, scopeOpts);
  const ranges = getRecentRanges(range, scope, scopeOpts, HISTORY_LENGTH[scope]);

  // Chips: the last 12 periods up to the current one (plus the selected one if it's older).
  const chips = useMemo(() => {
    if (scope === "custom") return [];
    const current = getScopeRange(scope, now, scopeOpts);
    let list = getRecentRanges(current, scope, scopeOpts, 12);
    if (!list.some((r) => sameStart(r, range)) && range.start < list[0].start) list = [range, ...list];
    return list.map((r) => ({ range: r, chip: periodLabel(r, scope, now).chip, current: sameStart(r, current) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` and options are stable within a render's inputs
  }, [scope, range.start.getTime(), settings.cycleDay, settings.weekendRule, JSON.stringify(settings.cycleOverrides), settings.weekStartsOn]);
  const selectedChip = chips.findIndex((c) => sameStart(c.range, range));

  // One request covers the selected period and the earlier ones it's compared with.
  const { data: allExpenses = [], isLoading } = useExpenses({ start: ranges[0].start, end: range.end });
  const expenses = useMemo(() => splitByCurrency(allExpenses, mainCurrency).main, [allExpenses, mainCurrency]);
  const otherCurrencies = useMemo(
    () => splitByCurrency(allExpenses.filter((e) => isInRange(e.date, range)), mainCurrency).others,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allExpenses, mainCurrency, range.start.getTime(), range.end.getTime()],
  );
  const inRange = useMemo(() => expenses.filter((e) => isInRange(e.date, range)), [expenses, range]);

  const comparison = comparePeriods(expenses, ranges, now, mode);
  const label = periodLabel(range, scope, now);
  const baselineText = comparison.baseline === null
    ? `No earlier ${noun}s with spending to compare with yet`
    : `vs ${mode === "previous" ? `last ${noun}` : `${comparison.baselineRanges.length}-${noun} average`}${comparison.partial ? " at the same point" : ""}`;

  const hist = history(expenses, ranges, now);
  const bars: HistoryBar[] = hist.bars.map((b) => ({ ...b, ...periodLabel(b.range, scope, now) }));

  const buckets = timeBuckets(range, scope).map((b) => ({ label: b.label, total: sumIn(inRange, b.range) }));
  const peakBucket = buckets.some((b) => b.total > 0) ? buckets.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const weekdays = useMemo(() => {
    const byDay: Record<string, number> = {};
    inRange.forEach((e) => {
      const day = format(new Date(e.date), "EEEE");
      byDay[day] = (byDay[day] || 0) + Number(e.amount);
    });
    return Object.entries(byDay).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  }, [inRange]);

  const categories = categoryComparison(expenses, range, comparison.baselineRanges)
    .map((c) => ({ ...c, info: resolveCategory(c.id, customCategories) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const biggestIncrease = categories.filter((c) => c.baseline && c.pct! > 0).sort((a, b) => b.pct! - a.pct!)[0];

  // Cycle start details for the header: moved by the user, or by the weekend rule.
  const cycleInfo = scope === "cycle" ? (() => {
    const nominal = nominalStartOfCycle(range, settings.cycleDay);
    const moved = !sameStart(range, { start: nominal, end: nominal });
    return { nominal, moved, overridden: !!settings.cycleOverrides[cycleKey(nominal)] };
  })() : null;
  const inProgress = now >= range.start && now < range.end;
  const dayOf = inProgress ? Math.floor((now.getTime() - range.start.getTime()) / 86_400_000) + 1 : null;
  const daysIn = Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000);

  const go = (next: Record<string, string>) => setParams(next, { replace: false });
  const selectScope = (s: InsightScope) => (s === "custom" ? go({ scope: s, from: iso(subDays(now, 29)), to: iso(now) }) : go({ scope: s }));
  const selectRange = (r: DateRange) => go({ scope, at: iso(r.start) });
  const initials = initialsOf(profile, user?.email);
  const primary = gradientStops("mint");

  return (
    <div className="min-h-screen bg-background pb-24 px-8 pt-8 max-w-lg mx-auto lg:max-w-6xl text-foreground transition-all duration-500">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" aria-label="Home" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} weight="bold" />
          </Link>
          <h2 className="font-display font-bold text-2xl text-foreground">Insights</h2>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/profile" aria-label="Profile" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-glass-border hover:border-primary/50 transition-colors">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-primary">{initials}</span>}
          </Link>
        </div>
      </motion.div>

      <ScopeTabs value={scope} onChange={selectScope} />
      {scope === "custom" ? (
        <div className="flex items-center gap-3 pb-3 pt-1">
          <DateRangePicker
            date={{ from: customRange.start, to: lastDayOf(customRange) }}
            onDateChange={(r: DayPickerRange | undefined) => r?.from && r?.to && go({ scope, from: iso(r.from), to: iso(r.to) })}
          />
          <span className="text-sm font-display font-semibold">{label.span}</span>
        </div>
      ) : (
        <PeriodChips periods={chips} selected={selectedChip} onSelect={(i) => selectRange(chips[i].range)} />
      )}

      {/* What exactly is being looked at */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-6 text-xs text-muted-foreground" data-testid="period-header">
        <span className="font-display font-bold text-base text-foreground">{scope === "custom" ? label.span : label.title}</span>
        {scope !== "custom" && <span>{label.span}</span>}
        {dayOf && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            <Clock size={12} weight="bold" /> Day {dayOf} of {daysIn}
          </span>
        )}
        {cycleInfo?.moved && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
            <CalendarCheck size={12} weight="bold" />
            Started {format(range.start, "EEE, MMM d")} {cycleInfo.overridden ? "· payday moved" : `· day ${settings.cycleDay} was a weekend`}
          </span>
        )}
        {cycleInfo && (
          <button onClick={() => setPaydayOpen(true)} data-testid="payday-moved" className="underline underline-offset-2 hover:text-foreground">
            Payday moved?
          </button>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* Total + comparison */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 md:p-8">
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-[0.1em] mb-2 font-body block">
              {inProgress ? `Spent this ${noun} so far` : "Total spending"}
            </span>
            {isLoading ? (
              <Skeleton className="h-12 w-48 bg-muted/50" />
            ) : (
              <>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-foreground tracking-tight">{formatMoney(comparison.current, mainCurrency)}</h1>
                <OtherCurrenciesNote totals={otherCurrencies} className="mt-2" />
              </>
            )}

            <div className="pt-6 mt-6 border-t border-glass-border/50">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ChartLineUp size={20} weight="bold" className="text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider font-body whitespace-nowrap">Compare</span>
                </div>
                <div role="radiogroup" aria-label="Compare with" className="flex p-0.5 rounded-full bg-muted text-[11px] font-medium">
                  {(["previous", "average"] as const).map((m) => (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={mode === m}
                      data-testid={`baseline-${m}`}
                      onClick={() => setMode(m)}
                      className={cn("px-2.5 py-1 rounded-full whitespace-nowrap transition-colors", mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
                    >
                      {m === "previous" ? `Last ${noun}` : "Average"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4" data-testid="pulse">
                {comparison.pct !== null && (
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl font-display font-bold text-sm",
                    comparison.diff <= 0 ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral",
                  )}>
                    {comparison.diff <= 0 ? <TrendDown size={16} weight="bold" /> : <TrendUp size={16} weight="bold" />}
                    {Math.abs(comparison.pct)}%
                  </div>
                )}
                <div className="flex flex-col justify-center min-w-0">
                  {comparison.baseline !== null && (
                    <span className="text-foreground font-bold font-display text-lg leading-tight">
                      {comparison.diff >= 0 ? "+" : "−"}{formatMoney(Math.abs(comparison.diff), mainCurrency)}
                    </span>
                  )}
                  <span className="text-muted-foreground text-[11px] font-medium font-body">{baselineText}</span>
                  {comparison.baseline !== null && (
                    <span className="text-muted-foreground/70 text-[11px] font-body">
                      {mode === "previous" ? `Last ${noun}` : "Average"}{comparison.partial ? " by this point" : ""}: {formatMoney(comparison.baseline, mainCurrency)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Earlier periods of the same kind */}
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }} className="glass-card p-6">
            <h3 className="font-display font-bold text-foreground text-sm mb-1">Last {bars.length} {noun}s</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {hist.average !== null
                ? `Dashed line: ${formatMoney(hist.average, mainCurrency)}, the average of finished ${noun}s with spending. Tap a bar to open that ${noun}.`
                : `Tap a bar to open that ${noun}.`}
            </p>
            {isLoading ? <Skeleton className="h-56 w-full bg-muted/30" /> : (
              <HistoryChart bars={bars} average={hist.average} currency={mainCurrency} onSelect={(b) => scope === "custom" ? go({ scope, from: iso(b.range.start), to: iso(lastDayOf(b.range)) }) : selectRange(b.range)} />
            )}
          </motion.div>

          {/* Inside the period */}
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 }} className="glass-card p-6">
            <h3 className="font-display font-bold text-foreground text-sm mb-6">By {BUCKET_NOUN[scope]}</h3>
            {isLoading ? (
              <div className="h-48 flex items-end gap-3 justify-around">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[40%] w-10 bg-muted/30" />)}</div>
            ) : buckets.some((b) => b.total > 0) ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={buckets}>
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis hide />
                    <Tooltip cursor={false} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const b = payload[0].payload as { label: string; total: number };
                      return (
                        <div className="bg-card border border-glass-border rounded-xl px-3 py-1.5 text-xs shadow-xl">
                          <span className="font-medium text-foreground">{b.label}: {formatMoney(b.total, mainCurrency)}</span>
                        </div>
                      );
                    }} />
                    <Bar dataKey="total" radius={[8, 8, 0, 0]} animationDuration={800}>
                      {buckets.map((b) => <Cell key={b.label} fill="url(#bucket-gradient)" />)}
                    </Bar>
                    <defs>
                      <linearGradient id="bucket-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={primary.from} />
                        <stop offset="100%" stopColor={primary.to} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">No spending in this {noun}</p>
            )}
          </motion.div>
        </div>

        <div className="lg:col-span-5 space-y-6 mt-6 lg:mt-0">
          {biggestIncrease && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-4 border-l-4 border-accent">
              <p className="text-foreground text-sm leading-relaxed">
                You spent <span className="font-bold text-accent">{biggestIncrease.pct}% more</span> on{" "}
                <CategoryIcon categoryId={biggestIncrease.id} customIcon={biggestIncrease.info.icon} size={16} className="inline-block align-text-bottom" /> {biggestIncrease.info.label}{" "}
                {mode === "previous" ? `than last ${noun}` : `than your ${noun} average`}{comparison.partial ? " at this point" : ""}.
              </p>
            </motion.div>
          )}

          {peakBucket && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={cn("grid gap-3", scope === "week" ? "grid-cols-1" : "grid-cols-2")}>
              <button onClick={() => setSelectedDetail("bucket")} className="glass-card p-4 flex flex-col justify-between text-left hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
                  <TrendUp size={14} weight="bold" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Peak {BUCKET_NOUN[scope]}</span>
                </div>
                <p className="font-display font-bold text-lg text-foreground">{peakBucket.label}</p>
                <p className="text-xs text-muted-foreground">{formatMoney(peakBucket.total, mainCurrency)}</p>
              </button>
              {scope !== "week" && weekdays[0] && (
                <button onClick={() => setSelectedDetail("day")} className="glass-card p-4 flex flex-col justify-between text-left hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
                    <CalendarBlank size={14} weight="bold" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Top weekday</span>
                  </div>
                  <p className="font-display font-bold text-lg text-foreground">{weekdays[0].label}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(weekdays[0].amount, mainCurrency)}</p>
                </button>
              )}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="glass-card p-6">
            <div className="flex items-baseline justify-between mb-4 gap-2">
              <h3 className="font-display font-bold text-foreground text-sm uppercase tracking-wider opacity-60">Category breakdown</h3>
              {comparison.baseline !== null && <span className="text-[10px] text-muted-foreground">change {mode === "previous" ? `vs last ${noun}` : "vs average"}</span>}
            </div>
            {isLoading ? (
              <div className="space-y-4 py-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-12" /></div>
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                ))}
              </div>
            ) : categories.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No spending in this {noun}</p>
            ) : (
              <div className="space-y-4">
                {categories.map((cat) => (
                  <div key={cat.id} className="group">
                    <div className="flex items-center justify-between gap-2 text-sm mb-1.5">
                      <span className="flex items-center gap-2 min-w-0">
                        <CategoryIcon categoryId={cat.id} customIcon={cat.info.icon} size={18} />
                        <span className="font-medium truncate">{cat.info.label}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {comparison.baseline !== null && (
                          <span className={cn(
                            "text-[10px] font-bold",
                            cat.pct === null ? "text-muted-foreground" : cat.pct > 0 ? "text-coral" : "text-mint",
                          )}>
                            {cat.pct === null ? "new" : `${cat.pct > 0 ? "▲" : cat.pct < 0 ? "▼" : ""}${Math.abs(cat.pct)}%`}
                          </span>
                        )}
                        <span className="font-bold text-foreground">{formatMoney(cat.total, mainCurrency)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(cat.total / categories[0].total) * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                        className="h-full rounded-full"
                        style={{ background: gradientCss(cat.info.color) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <InsightDetailsSheet
        open={selectedDetail !== null}
        onClose={() => setSelectedDetail(null)}
        title={selectedDetail === "bucket" ? `Spending by ${BUCKET_NOUN[scope]}` : "Spending by weekday"}
        data={selectedDetail === "bucket" ? [...buckets].filter((b) => b.total > 0).map((b) => ({ label: b.label, amount: b.total })).sort((a, b) => b.amount - a.amount) : weekdays}
        currencySymbol={getCurrencySymbol(mainCurrency)}
      />
      {scope === "cycle" && <PaydaySheet open={paydayOpen} onClose={() => setPaydayOpen(false)} cycle={range} settings={settings} />}
    </div>
  );
};

export default Insights;
