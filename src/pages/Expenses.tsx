import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CaretLeft, CaretRight, MagnifyingGlass, Receipt } from "@phosphor-icons/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addMonths, format, isToday, isYesterday, parse, startOfMonth } from "date-fns";
import { toast } from "sonner";
import TransactionCard from "@/components/TransactionCard";
import AddExpenseSheet from "@/components/AddExpenseSheet";
import ExpenseDetailSheet from "@/components/ExpenseDetailSheet";
import OtherCurrenciesNote from "@/components/OtherCurrenciesNote";
import { useCustomCategories, useExpenseMutations, useExpenses } from "@/hooks/useExpenses";
import { useSettings } from "@/hooks/useProfile";
import { formatMoney, splitByCurrency, sumAmounts } from "@/lib/currencies";
import type { Expense } from "@/lib/expenses";

/** "?month=2026-09" → Sep 1 2026; anything else → this month. */
function monthFromParam(value: string | null): Date {
  const parsed = value ? parse(value, "yyyy-MM", new Date()) : null;
  return parsed && !isNaN(parsed.getTime()) ? startOfMonth(parsed) : startOfMonth(new Date());
}

const dayLabel = (day: Date) => (isToday(day) ? "Today" : isYesterday(day) ? "Yesterday" : format(day, "EEE, MMM d"));

/** Expenses newest first → one group per calendar day. */
function groupByDay(expenses: Expense[]) {
  const groups: { key: string; day: Date; items: Expense[] }[] = [];
  for (const e of expenses) {
    const day = new Date(e.date);
    const key = format(day, "yyyy-MM-dd");
    if (groups[groups.length - 1]?.key !== key) groups.push({ key, day, items: [] });
    groups[groups.length - 1].items.push(e);
  }
  return groups;
}

/** Every expense, one calendar month at a time. Reached from Home's "See all". */
const Expenses = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const month = monthFromParam(params.get("month"));
  const isCurrentMonth = month.getTime() >= startOfMonth(new Date()).getTime();
  const goTo = (m: Date) => setParams({ month: format(m, "yyyy-MM") }, { replace: true });

  const { settings } = useSettings();
  const mainCurrency = settings.currency;
  const { data: customCategories = [] } = useCustomCategories();
  const { data: expenses = [], isLoading } = useExpenses({ start: month, end: addMonths(month, 1) });
  const { remove } = useExpenseMutations();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Expense | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);

  const q = query.trim().toLowerCase();
  const shown = q ? expenses.filter((e) => e.title.toLowerCase().includes(q) || e.note?.toLowerCase().includes(q)) : expenses;
  const split = splitByCurrency(shown, mainCurrency);
  const groups = groupByDay(shown);

  const handleDelete = (id: string) => {
    remove.mutate(id, { onError: (err) => toast.error(err.message) });
  };

  return (
    <div className="min-h-screen bg-background pb-24 px-6 sm:px-8 pt-8 max-w-lg mx-auto overflow-x-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} weight="bold" />
        </button>
        <h2 className="font-display font-bold text-2xl text-foreground truncate">All expenses</h2>
      </motion.div>

      <div className="glass-card p-4 mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => goTo(addMonths(month, -1))}
            aria-label="Previous month"
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <div className="text-center">
            <p data-testid="expenses-month" className="font-display font-bold text-foreground">{format(month, "MMMM yyyy")}</p>
            <p data-testid="expenses-summary" className="text-xs text-muted-foreground">
              {formatMoney(sumAmounts(split.main), mainCurrency)} · {shown.length} {shown.length === 1 ? "expense" : "expenses"}
            </p>
          </div>
          <button
            onClick={() => goTo(addMonths(month, 1))}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
        <OtherCurrenciesNote totals={split.others} className="text-center mt-1" />
      </div>

      <label className="relative block mb-5">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${format(month, "MMMM")}`}
          aria-label="Search this month"
          className="w-full h-11 pl-9 pr-3 rounded-xl bg-muted/60 border border-glass-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
      </label>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="glass-card h-[72px] animate-pulse" />)}</div>
      ) : groups.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <Receipt size={28} className="mx-auto text-primary mb-3" />
          <p className="text-muted-foreground text-sm">
            {q ? `Nothing matching “${query.trim()}” in ${format(month, "MMMM")}` : `No expenses in ${format(month, "MMMM yyyy")}`}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.key} data-testid="expenses-day">
              <div className="flex items-baseline justify-between mb-2 px-1">
                <h3 className="text-xs font-medium text-muted-foreground">{dayLabel(g.day)}</h3>
                <span className="text-xs text-muted-foreground">{formatMoney(sumAmounts(splitByCurrency(g.items, mainCurrency).main), mainCurrency)}</span>
              </div>
              <div className="flex flex-col gap-2">
                {g.items.map((exp, i) => (
                  <TransactionCard
                    key={exp.id}
                    expense={exp}
                    index={i}
                    onTap={setSelected}
                    customCategories={customCategories}
                    mainCurrency={mainCurrency}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <AddExpenseSheet open={!!editing} onClose={() => setEditing(null)} expense={editing} />
      <ExpenseDetailSheet
        expense={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
        onEdit={(exp) => { setSelected(null); setEditing(exp); }}
        customCategories={customCategories}
        mainCurrency={mainCurrency}
      />
    </div>
  );
};

export default Expenses;
