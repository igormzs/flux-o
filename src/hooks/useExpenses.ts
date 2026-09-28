import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCustomCategory,
  deleteExpense,
  getCustomCategories,
  getExpensesInRange,
  getRecentExpenses,
  saveExpense,
  updateExpense,
  type ExpenseInput,
} from "@/lib/expenses";
import type { DateRange } from "@/lib/date-utils";

/**
 * All expense and category data goes through react-query. v1 mixed this with
 * imperative fetches into component state, so screens could show stale data
 * after a save.
 */

export const expenseKeys = {
  all: ["expenses"] as const,
  range: (r: DateRange) => ["expenses", "range", r.start.toISOString(), r.end.toISOString()] as const,
  recent: (limit: number) => ["expenses", "recent", limit] as const,
};

export const useExpenses = (range: DateRange | null) => {
  return useQuery({
    queryKey: range ? expenseKeys.range(range) : ["expenses", "none"],
    queryFn: () => getExpensesInRange(range!),
    enabled: !!range,
  });
};

export const useRecentExpenses = (limit = 10) => {
  return useQuery({ queryKey: expenseKeys.recent(limit), queryFn: () => getRecentExpenses(limit) });
};

export const useCustomCategories = () => {
  return useQuery({ queryKey: ["custom_categories"], queryFn: getCustomCategories });
};

export const useExpenseMutations = () => {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: expenseKeys.all });
  return {
    save: useMutation({ mutationFn: (input: ExpenseInput) => saveExpense(input), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ExpenseInput }) => updateExpense(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteExpense(id), onSuccess }),
  };
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCustomCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom_categories"] }),
  });
};
