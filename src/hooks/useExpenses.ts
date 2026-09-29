import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  countExpensesInCategory,
  createCustomCategory,
  deleteCategory,
  deleteExpense,
  restoreCategory,
  saveCategoryOrder,
  updateCategory,
  type CategoryLook,
  type CustomCategory,
  getCustomCategories,
  getExpensesInRange,
  getRecentExpenses,
  saveExpense,
  updateExpense,
  type ExpenseInput,
} from "@/lib/expenses";
import type { DateRange } from "@/lib/date-utils";
import { DEFAULT_CATEGORIES, isBuiltinKey, nextSortOrder } from "@/lib/categories";

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

export const categoryKeys = { all: ["custom_categories"] as const };

export const useCustomCategories = () => {
  return useQuery({ queryKey: categoryKeys.all, queryFn: getCustomCategories });
};

export const useCategoryExpenseCount = (id: string | null) => {
  return useQuery({
    queryKey: ["expenses", "count", id],
    queryFn: () => countExpensesInCategory(id!),
    enabled: !!id,
  });
};

/** The cached rows with `orderedIds[i]` at position i, so a drag doesn't snap back while saving. */
function withOrder(rows: CustomCategory[], orderedIds: string[]): CustomCategory[] {
  const next = rows.map((r) => ({ ...r }));
  orderedIds.forEach((id, i) => {
    const row = isBuiltinKey(id) ? next.find((r) => r.builtin_key === id) : next.find((r) => r.id === id);
    if (row) row.sort_order = i;
    else if (isBuiltinKey(id)) {
      const d = DEFAULT_CATEGORIES.find((c) => c.id === id)!;
      next.push({ id: `pending-${id}`, user_id: "", label: d.label, icon: d.icon, color: d.color, created_at: "", builtin_key: id, sort_order: i });
    }
  });
  return next;
}

export const useCategoryMutations = () => {
  const queryClient = useQueryClient();
  const rows = () => queryClient.getQueryData<CustomCategory[]>(categoryKeys.all) ?? [];
  const refreshCategories = () => queryClient.invalidateQueries({ queryKey: categoryKeys.all });
  return {
    create: useMutation({
      mutationFn: (look: CategoryLook) => createCustomCategory({ ...look, sort_order: nextSortOrder(rows()) }),
      onSuccess: refreshCategories,
    }),
    update: useMutation({
      mutationFn: ({ id, look }: { id: string; look: CategoryLook }) => updateCategory(id, look),
      onSuccess: refreshCategories,
    }),
    reorder: useMutation({
      mutationFn: (orderedIds: string[]) => saveCategoryOrder(orderedIds, rows()),
      onMutate: async (orderedIds) => {
        await queryClient.cancelQueries({ queryKey: categoryKeys.all });
        const previous = rows();
        queryClient.setQueryData(categoryKeys.all, withOrder(previous, orderedIds));
        return { previous };
      },
      onError: (_err, _ids, ctx) => ctx && queryClient.setQueryData(categoryKeys.all, ctx.previous),
      onSettled: refreshCategories,
    }),
    remove: useMutation({
      mutationFn: ({ id, moveTo }: { id: string; moveTo: string | null }) => deleteCategory(id, moveTo, rows()),
      onSuccess: () => {
        refreshCategories();
        // Moved expenses change every list and chart that shows them.
        queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      },
    }),
    restore: useMutation({ mutationFn: restoreCategory, onSuccess: refreshCategories }),
  };
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
