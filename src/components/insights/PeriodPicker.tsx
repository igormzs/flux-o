import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { INSIGHT_SCOPES, type InsightScope } from "@/lib/insights";
import type { DateRange } from "@/lib/date-utils";

interface ScopeTabsProps {
  value: InsightScope;
  onChange: (scope: InsightScope) => void;
}

/** Cycle · Month · Week · Year · Custom. v1 only had the salary cycle (plus a custom range). */
export const ScopeTabs = ({ value, onChange }: ScopeTabsProps) => (
  <div role="tablist" aria-label="Period type" className="flex p-1 rounded-full bg-muted border border-glass-border mb-4 w-full sm:w-fit">
    {INSIGHT_SCOPES.map((s) => {
      const active = s.id === value;
      return (
        <button
          key={s.id}
          role="tab"
          aria-selected={active}
          data-testid={`scope-${s.id}`}
          onClick={() => onChange(s.id)}
          className={cn(
            "relative flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-full text-xs font-display font-semibold transition-colors",
            active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {active && (
            <motion.span layoutId="scope-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
          )}
          <span className="relative">{s.label}</span>
        </button>
      );
    })}
  </div>
);

interface PeriodChipsProps {
  periods: { range: DateRange; chip: string; current: boolean }[];
  selected: number;
  onSelect: (index: number) => void;
}

/** Recent periods of the chosen kind, newest on the right. */
export const PeriodChips = ({ periods, selected, onSelect }: PeriodChipsProps) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    refs.current[selected]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selected, periods.length]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x px-8 -mx-8" role="radiogroup" aria-label="Period">
      {periods.map((p, i) => {
        const active = i === selected;
        return (
          <button
            key={p.range.start.toISOString()}
            ref={(el) => (refs.current[i] = el)}
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(i)}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-full font-display font-semibold text-sm snap-center transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-muted text-muted-foreground hover:text-foreground border border-glass-border",
            )}
          >
            {p.chip}
            {p.current && <span className={cn("ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle", active ? "bg-primary-foreground" : "bg-primary")} aria-label="current" />}
          </button>
        );
      })}
    </div>
  );
};
