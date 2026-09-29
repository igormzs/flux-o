import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash, EyeSlash } from "@phosphor-icons/react";
import { toast } from "sonner";
import CategoryIcon from "@/components/CategoryIcon";
import ColorPicker from "./ColorPicker";
import IconPicker from "./IconPicker";
import { allCategories, categoryStyle, isLabelTaken, PALETTE, type CategoryInfo } from "@/lib/categories";
import { useCategoryMutations, useCustomCategories } from "@/hooks/useExpenses";

export const MAX_LABEL_LENGTH = 24;

interface CategoryEditorSheetProps {
  open: boolean;
  onClose: () => void;
  /** The category to edit; omit to create a new one. */
  category?: CategoryInfo | null;
  /** Called with the id of the created or edited category. */
  onSaved?: (id: string) => void;
  /** Shows a Delete (or Hide, for defaults) button when given. */
  onDelete?: (category: CategoryInfo) => void;
}

/** The first palette color no visible category uses yet, so new ones stand apart. */
function suggestColor(used: string[]) {
  const taken = new Set(used);
  return PALETTE.flatMap((r) => r.colors).find((c) => !taken.has(c)) ?? PALETTE[0].colors[0];
}

const CategoryEditorSheet = ({ open, onClose, category, onSaved, onDelete }: CategoryEditorSheetProps) => {
  const { data: rows = [] } = useCustomCategories();
  const { create, update } = useCategoryMutations();
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("Star");
  const [color, setColor] = useState(PALETTE[0].colors[0]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (category) {
      setLabel(category.label);
      setIcon(category.icon);
      setColor(category.color);
    } else {
      setLabel("");
      setIcon("Star");
      setColor(suggestColor(allCategories(rows).map((c) => c.color)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [open, category?.id]);

  const trimmed = label.trim();
  const error = !trimmed
    ? "Give the category a name."
    : isLabelTaken(trimmed, rows, category?.id)
      ? `You already have a category called “${trimmed}”.`
      : null;
  const saving = create.isPending || update.isPending;

  const handleSave = async () => {
    setTouched(true);
    if (error || saving) return;
    const look = { label: trimmed, icon, color };
    try {
      if (category) {
        await update.mutateAsync({ id: category.id, look });
        onSaved?.(category.id);
        toast.success("Category saved");
      } else {
        const created = await create.mutateAsync(look);
        onSaved?.(created.id);
        toast.success(`“${trimmed}” created`);
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-editor-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-card border-t border-glass-border rounded-t-3xl p-6 pb-10 max-h-[88vh] overflow-auto scrollbar-none overflow-x-hidden touch-pan-y max-w-xl mx-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 id="category-editor-title" className="font-display font-bold text-xl text-foreground">
                {category ? "Edit Category" : "New Category"}
              </h2>
              <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Live preview + name */}
            <div className="flex items-center gap-3 mb-2">
              <div
                data-testid="category-preview"
                style={categoryStyle(color)}
                className="cat cat-solid w-14 h-14 shrink-0 rounded-2xl border flex items-center justify-center"
              >
                <CategoryIcon categoryId="__preview__" customIcon={icon} size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <label htmlFor="category-name" className="text-sm text-muted-foreground mb-1.5 block">Name</label>
                <input
                  id="category-name"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. Coffee, Gym, Pets"
                  maxLength={MAX_LABEL_LENGTH}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onBlur={() => setTouched(true)}
                  aria-invalid={touched && !!error}
                  aria-describedby="category-name-error"
                  className="w-full h-11 rounded-xl bg-muted border-none px-4 text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                />
              </div>
            </div>
            <p id="category-name-error" role="status" className="min-h-5 text-xs text-destructive mb-3">
              {touched && error ? error : ""}
            </p>

            <div className="mb-5">
              <p className="text-sm text-muted-foreground mb-2">Color</p>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-2">Icon</p>
              <IconPicker value={icon} onChange={setIcon} />
            </div>

            <div className="flex gap-2">
              {category && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(category)}
                  className="h-12 px-4 rounded-2xl bg-destructive/10 text-destructive font-medium text-sm flex items-center gap-2 hover:bg-destructive/15 transition-colors"
                >
                  {category.builtin ? <EyeSlash size={18} weight="bold" /> : <Trash size={18} weight="bold" />}
                  {category.builtin ? "Hide" : "Delete"}
                </button>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={handleSave}
                disabled={saving || (touched && !!error)}
                className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-base disabled:opacity-30 transition-opacity"
              >
                {saving ? "Saving…" : category ? "Save Changes" : "Create Category"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CategoryEditorSheet;
