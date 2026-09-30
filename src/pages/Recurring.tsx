import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowsClockwise, PencilSimple, Plus } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import CategoryIcon from "@/components/CategoryIcon";
import BillEditorSheet from "@/components/bills/BillEditorSheet";
import OccurrenceRow from "@/components/bills/OccurrenceRow";
import { useBills } from "@/hooks/useBills";
import { useCustomCategories } from "@/hooks/useExpenses";
import { useSettings } from "@/hooks/useProfile";
import { categoryStyle, resolveCategory } from "@/lib/categories";
import { formatMoney } from "@/lib/currencies";
import { currentOccurrences, monthlyTotal, occurrenceKey, ordinal, parseBillAmount, type Occurrence, type RecurringExpense } from "@/lib/recurring";

const monthName = (period: string) => format(new Date(`${period}-01T00:00:00`), "MMMM");

/** Profile → Recurring expenses: set up bills, see this month's status, confirm or skip. */
const Recurring = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const mainCurrency = settings.currency;
  const { bills, all, isLoading, busy, confirm, setSkipped } = useBills(mainCurrency);
  const { data: customCategories = [] } = useCustomCategories();
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [creating, setCreating] = useState(false);
  const [typed, setTyped] = useState<Record<string, string>>({});

  const today = new Date();
  const total = monthlyTotal(bills, mainCurrency);
  const activeCount = bills.filter((b) => b.active).length;
  const amountOf = (o: Occurrence) => typed[occurrenceKey(o)] ?? o.suggestedAmount.toFixed(2);

  return (
    <div className="min-h-screen bg-background pb-24 px-6 sm:px-8 pt-8 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} weight="bold" />
          </button>
          <h2 className="font-display font-bold text-2xl text-foreground truncate">Recurring</h2>
        </div>
        <button data-testid="create-bill" onClick={() => setCreating(true)} className="h-9 px-3 shrink-0 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5">
          <Plus size={16} weight="bold" /> New
        </button>
      </motion.div>
      <p className="text-xs text-muted-foreground mb-5">
        Rent, utilities, subscriptions: set each one up once. When its day comes, Home asks you to confirm it with the real amount. Nothing is added by itself.
      </p>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <div key={i} className="glass-card h-[84px] animate-pulse" />)}</div>
      ) : bills.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <ArrowsClockwise size={28} className="mx-auto text-primary mb-3" />
          <p className="text-foreground text-sm font-medium mb-1">No recurring expenses yet</p>
          <p className="text-muted-foreground text-xs mb-4">Add the ones you pay every month. If this month’s was already paid, you can confirm it straight away.</p>
          <button onClick={() => setCreating(true)} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Add the first one</button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3" data-testid="bills-summary">
            <span className="text-foreground font-display font-bold">{formatMoney(total, mainCurrency)}</span> a month across {activeCount} {activeCount === 1 ? "expense" : "expenses"}
          </p>
          <div className="space-y-2">
            {bills.map((bill) => {
              const cat = resolveCategory(bill.category, customCategories);
              const rows = currentOccurrences(all, bill, today);
              return (
                <div key={bill.id} data-testid="bill-row" className={`glass-card p-3 ${bill.active ? "" : "opacity-60"}`}>
                  <button type="button" onClick={() => setEditing(bill)} aria-label={`Edit ${bill.title}`} className="flex w-full items-center gap-3 text-left">
                    <span style={categoryStyle(cat.color)} className="cat cat-soft w-10 h-10 shrink-0 rounded-xl flex items-center justify-center">
                      <CategoryIcon categoryId={cat.id} customIcon={cat.icon} size={20} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">{bill.title}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {bill.active ? `${ordinal(bill.day_of_month)} of each month` : "Paused"} · usually {formatMoney(Number(bill.amount), bill.currency ?? mainCurrency)}
                      </span>
                    </span>
                    <PencilSimple size={16} className="text-muted-foreground shrink-0" aria-hidden />
                  </button>
                  {rows.map((o) => (
                    <div key={o.period} className="mt-3 pt-3 border-t border-glass-border/50">
                      {o.status === "confirmed" && (
                        <p className="text-xs text-primary" data-testid="bill-status">
                          {monthName(o.period)}: confirmed, {formatMoney(o.confirmation!.amount, bill.currency ?? mainCurrency)}
                        </p>
                      )}
                      {o.status === "skipped" && (
                        <p className="text-xs text-muted-foreground" data-testid="bill-status">
                          {monthName(o.period)}: skipped
                          <button type="button" onClick={() => setSkipped(o, false)} className="ml-2 underline underline-offset-2 hover:text-foreground">Undo</button>
                        </p>
                      )}
                      {(o.status === "due" || o.status === "upcoming") && (
                        <OccurrenceRow
                          compact
                          occurrence={o}
                          category={cat}
                          mainCurrency={mainCurrency}
                          amount={amountOf(o)}
                          onAmountChange={(v) => setTyped((t) => ({ ...t, [occurrenceKey(o)]: v }))}
                          onConfirm={() => confirm(o, parseBillAmount(amountOf(o))!)}
                          onSkip={() => setSkipped(o, true)}
                          disabled={busy}
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      <BillEditorSheet open={creating || !!editing} bill={editing} mainCurrency={mainCurrency} onClose={() => { setCreating(false); setEditing(null); }} />
    </div>
  );
};

export default Recurring;
