import { useMemo } from "react";
import { toast } from "sonner";
import { useConfirmations, useExpenseMutations, useRecurringExpenses, useRecurringMutations } from "@/hooks/useExpenses";
import { confirmationExpense, dueOccurrences, occurrences, type Occurrence } from "@/lib/recurring";
import { formatMoney } from "@/lib/currencies";

/**
 * Recurring expenses with their status for last, this and next month, and the
 * actions on one occurrence: confirm it (creates the expense) or skip it.
 * Both can be undone from the toast.
 */
export const useBills = (mainCurrency: string) => {
  const { data: bills = [], isLoading: loadingBills } = useRecurringExpenses();
  const { data: confirmations = [], isLoading: loadingConfirmations } = useConfirmations();
  const { save, saveMany, remove, removeMany } = useExpenseMutations();
  const { update } = useRecurringMutations();

  const all = useMemo(() => occurrences(bills, confirmations, new Date()), [bills, confirmations]);
  const due = useMemo(() => dueOccurrences(all), [all]);

  const confirm = async (o: Occurrence, amount: number) => {
    try {
      const saved = await save.mutateAsync(confirmationExpense(o, amount, new Date()));
      toast.success(`${o.bill.title} added: ${formatMoney(amount, o.bill.currency ?? mainCurrency)}`, {
        action: { label: "Undo", onClick: () => remove.mutate(saved.id) },
      });
    } catch (err) {
      toast.error(`Couldn't add ${o.bill.title}: ${(err as Error).message}`);
    }
  };

  const confirmMany = async (items: { occurrence: Occurrence; amount: number }[]) => {
    try {
      const ids = await saveMany.mutateAsync(items.map((i) => confirmationExpense(i.occurrence, i.amount, new Date())));
      toast.success(`${ids.length} recurring expenses added`, { action: { label: "Undo", onClick: () => removeMany.mutate(ids) } });
    } catch (err) {
      toast.error(`Couldn't add them: ${(err as Error).message}`);
    }
  };

  const setSkipped = (o: Occurrence, skipped: boolean) => {
    const others = (o.bill.skipped ?? []).filter((p) => p !== o.period);
    update.mutate(
      { id: o.bill.id, patch: { skipped: skipped ? [...others, o.period] : others } },
      {
        onSuccess: () => {
          if (skipped) toast(`${o.bill.title} skipped this time`, { action: { label: "Undo", onClick: () => setSkipped(o, false) } });
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return {
    bills,
    all,
    due,
    isLoading: loadingBills || loadingConfirmations,
    busy: save.isPending || saveMany.isPending || update.isPending,
    confirm,
    confirmMany,
    setSkipped,
  };
};
