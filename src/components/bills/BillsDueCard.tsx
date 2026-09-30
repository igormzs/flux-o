import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowsClockwise, CaretRight } from "@phosphor-icons/react";
import OccurrenceRow from "./OccurrenceRow";
import { useBills } from "@/hooks/useBills";
import { useCustomCategories } from "@/hooks/useExpenses";
import { resolveCategory } from "@/lib/categories";
import { formatMoney } from "@/lib/currencies";
import { occurrenceKey, parseBillAmount, stillToCome, type Occurrence } from "@/lib/recurring";
import type { DateRange } from "@/lib/date-utils";

interface BillsDueCardProps {
  mainCurrency: string;
  /** The current pay cycle, for "still to come". */
  cycle: DateRange;
}

/**
 * Home: recurring expenses whose day has come, each with its amount ready to
 * confirm, and how much is still to come this cycle. Hidden when there's
 * nothing to confirm and nothing coming.
 */
const BillsDueCard = ({ mainCurrency, cycle }: BillsDueCardProps) => {
  const { all, due, busy, confirm, confirmMany, setSkipped } = useBills(mainCurrency);
  const { data: customCategories = [] } = useCustomCategories();
  const [typed, setTyped] = useState<Record<string, string>>({});

  const toCome = stillToCome(all, cycle, mainCurrency);
  if (due.length === 0 && toCome.count === 0) return null;

  const amountOf = (o: Occurrence) => typed[occurrenceKey(o)] ?? o.suggestedAmount.toFixed(2);
  const allValid = due.every((o) => parseBillAmount(amountOf(o)) !== null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 }}
      aria-label="Recurring expenses"
      data-testid="bills-due-card"
      className="glass-card p-5 md:p-6"
    >
      {due.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowsClockwise size={18} weight="bold" className="text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-body">
                {due.length === 1 ? "1 recurring expense to confirm" : `${due.length} recurring expenses to confirm`}
              </h3>
            </div>
            {due.length > 1 && (
              <button
                type="button"
                disabled={busy || !allValid}
                onClick={() => confirmMany(due.map((o) => ({ occurrence: o, amount: parseBillAmount(amountOf(o))! })))}
                className="h-8 px-3 rounded-lg bg-primary/15 text-primary text-xs font-bold shrink-0 disabled:opacity-50"
              >
                Confirm all
              </button>
            )}
          </div>
          <div className="space-y-3">
            {due.map((o) => (
              <OccurrenceRow
                key={occurrenceKey(o)}
                occurrence={o}
                category={resolveCategory(o.bill.category, customCategories)}
                mainCurrency={mainCurrency}
                amount={amountOf(o)}
                onAmountChange={(v) => setTyped((t) => ({ ...t, [occurrenceKey(o)]: v }))}
                onConfirm={() => confirm(o, parseBillAmount(amountOf(o))!)}
                onSkip={() => setSkipped(o, true)}
                disabled={busy}
              />
            ))}
          </div>
        </>
      )}
      <Link
        to="/recurring"
        data-testid="bills-to-come"
        className={`flex items-center justify-between gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors ${due.length > 0 ? "mt-4 pt-4 border-t border-glass-border/50" : ""}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {due.length === 0 && <ArrowsClockwise size={18} weight="bold" className="text-primary shrink-0" />}
          <span>
            {toCome.count > 0 ? (
              <><span className="text-foreground font-bold font-display">{formatMoney(toCome.total, mainCurrency)}</span> in recurring expenses still to come this cycle</>
            ) : "Manage recurring expenses"}
          </span>
        </span>
        <CaretRight size={16} weight="bold" className="shrink-0" />
      </Link>
    </motion.section>
  );
};

export default BillsDueCard;
