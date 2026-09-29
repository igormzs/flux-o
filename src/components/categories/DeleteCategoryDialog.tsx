import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CategoryIcon from "@/components/CategoryIcon";
import { allCategories, categoryStyle, type CategoryInfo } from "@/lib/categories";
import { useCategoryExpenseCount, useCategoryMutations, useCustomCategories } from "@/hooks/useExpenses";

interface DeleteCategoryDialogProps {
  category: CategoryInfo | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Deletes a custom category or hides a default one. When it still has
 * expenses, the user picks where they go first, so nothing is left without a
 * category (the database function does both in one transaction).
 */
const DeleteCategoryDialog = ({ category, onOpenChange }: DeleteCategoryDialogProps) => {
  const { data: rows = [] } = useCustomCategories();
  const { data: count, isLoading, isError } = useCategoryExpenseCount(category?.id ?? null);
  const { remove } = useCategoryMutations();
  const [moveTo, setMoveTo] = useState<string | null>(null);

  useEffect(() => setMoveTo(null), [category?.id]);

  if (!category) return null;
  const targets = allCategories(rows).filter((c) => c.id !== category.id);
  const needsTarget = (count ?? 0) > 0;
  const lastOne = targets.length === 0;
  const verb = category.builtin ? "Hide" : "Delete";
  const n = count ?? 0;

  const handleConfirm = async () => {
    try {
      const moved = await remove.mutateAsync({ id: category.id, moveTo: needsTarget ? moveTo : null });
      const target = targets.find((t) => t.id === moveTo);
      toast.success(
        `${category.label} ${category.builtin ? "hidden" : "deleted"}` +
          (moved ? ` · ${moved} expense${moved === 1 ? "" : "s"} moved to ${target?.label}` : ""),
      );
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card border-glass-border rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">
            {verb} “{category.label}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {category.builtin
              ? "Default categories can’t be deleted, but you can hide them and bring them back any time from Categories."
              : "This can’t be undone."}
            {lastOne && " You need at least one category, so create another one first."}
            {isError && " Couldn’t check whether it has expenses. Close this and try again."}
            {!isLoading && !isError && !lastOne && (
              <>
                {" "}
                {needsTarget
                  ? `It has ${n} expense${n === 1 ? "" : "s"}. Choose where to move ${n === 1 ? "it" : "them"}:`
                  : "It has no expenses."}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {needsTarget && !lastOne && (
          <div role="radiogroup" aria-label="Move expenses to" className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto scrollbar-none p-0.5">
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={moveTo === t.id}
                onClick={() => setMoveTo(t.id)}
                style={categoryStyle(t.color)}
                className={`cat flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] font-medium transition-all ${
                  moveTo === t.id ? "cat-solid" : "cat-tile"
                }`}
              >
                <CategoryIcon categoryId={t.id} customIcon={t.icon} size={20} />
                <span className="truncate w-full text-center">{t.label}</span>
              </button>
            ))}
          </div>
        )}

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={lastOne || isLoading || isError || remove.isPending || (needsTarget && !moveTo)}
            className="h-10 px-4 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-40"
          >
            {remove.isPending ? `${verb === "Hide" ? "Hiding" : "Deleting"}…` : needsTarget ? `Move & ${verb.toLowerCase()}` : verb}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteCategoryDialog;
