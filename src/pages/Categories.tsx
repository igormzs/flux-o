import { useEffect, useRef, useState } from "react";
import { motion, Reorder, useDragControls } from "framer-motion";
import { ArrowLeft, DotsSixVertical, PencilSimple, Plus, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import CategoryIcon from "@/components/CategoryIcon";
import CategoryEditorSheet from "@/components/categories/CategoryEditorSheet";
import DeleteCategoryDialog from "@/components/categories/DeleteCategoryDialog";
import { allCategories, categoryStyle, type CategoryInfo } from "@/lib/categories";
import { useCategoryMutations, useCustomCategories } from "@/hooks/useExpenses";

interface RowProps {
  category: CategoryInfo;
  index: number;
  total: number;
  onEdit: () => void;
  onMove: (from: number, to: number) => void;
  onDragEnd: () => void;
}

const CategoryRow = ({ category, index, total, onEdit, onMove, onDragEnd }: RowProps) => {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={category.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      data-testid={`category-row-${category.id}`}
      className="glass-card flex items-center gap-3 p-2.5 pr-3 select-none"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
    >
      {/* Drag with pointer/touch; arrow keys move it for keyboard users. */}
      <button
        type="button"
        aria-label={`Reorder ${category.label}, position ${index + 1} of ${total}. Use arrow keys to move.`}
        onPointerDown={(e) => controls.start(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" && index > 0) { e.preventDefault(); onMove(index, index - 1); }
          if (e.key === "ArrowDown" && index < total - 1) { e.preventDefault(); onMove(index, index + 1); }
        }}
        className="w-8 h-10 flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing touch-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <DotsSixVertical size={20} weight="bold" />
      </button>
      <button type="button" onClick={onEdit} aria-label={`Edit ${category.label}${category.builtin ? " (default)" : ""}`} className="flex flex-1 min-w-0 items-center gap-3 text-left">
        <span style={categoryStyle(category.color)} className="cat cat-soft w-10 h-10 shrink-0 rounded-xl flex items-center justify-center">
          <CategoryIcon categoryId={category.id} customIcon={category.icon} size={22} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-foreground truncate">{category.label}</span>
          {category.builtin && <span className="block text-[11px] text-muted-foreground">Default</span>}
        </span>
        <PencilSimple size={16} className="text-muted-foreground shrink-0" aria-hidden />
      </button>
    </Reorder.Item>
  );
};

const Categories = () => {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useCustomCategories();
  const { reorder, restore } = useCategoryMutations();
  const all = allCategories(rows, { includeHidden: true });
  const visible = all.filter((c) => !c.hidden);
  const hidden = all.filter((c) => c.hidden);

  // Local order while dragging; saved when the drag ends.
  const [order, setOrder] = useState<string[]>([]);
  const orderRef = useRef(order);
  orderRef.current = order;
  const visibleKey = visible.map((c) => c.id).join(",");
  useEffect(() => setOrder(visibleKey ? visibleKey.split(",") : []), [visibleKey]);

  const [editing, setEditing] = useState<CategoryInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CategoryInfo | null>(null);

  const saveOrder = (ids: string[]) => {
    if (ids.join(",") === visibleKey) return;
    reorder.mutate(ids, { onError: (err) => toast.error(`Couldn’t save the new order: ${err.message}`) });
  };
  const move = (from: number, to: number) => {
    const next = [...orderRef.current];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);
    saveOrder(next);
  };

  const byId = new Map(visible.map((c) => [c.id, c]));

  return (
    <div className="min-h-screen bg-background pb-24 px-6 sm:px-8 pt-8 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} weight="bold" />
          </button>
          <h2 className="font-display font-bold text-2xl text-foreground">Categories</h2>
        </div>
        <button
          data-testid="create-category"
          onClick={() => setCreating(true)}
          className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5"
        >
          <Plus size={16} weight="bold" /> New
        </button>
      </motion.div>
      <p className="text-xs text-muted-foreground mb-5">
        Tap a category to edit it. Drag <DotsSixVertical size={12} weight="bold" className="inline align-[-1px]" /> to change the order you see when adding an expense.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="glass-card h-[60px] animate-pulse" />)}
        </div>
      ) : (
        <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
          {order.map((id, i) => {
            const c = byId.get(id);
            return c ? (
              <CategoryRow
                key={id}
                category={c}
                index={i}
                total={order.length}
                onEdit={() => setEditing(c)}
                onMove={move}
                onDragEnd={() => saveOrder(orderRef.current)}
              />
            ) : null;
          })}
        </Reorder.Group>
      )}

      {hidden.length > 0 && (
        <section className="mt-8">
          <h3 className="font-display font-bold text-foreground text-sm mb-1">Hidden</h3>
          <p className="text-xs text-muted-foreground mb-3">Not offered when adding expenses. Past expenses keep their category.</p>
          <div className="space-y-2">
            {hidden.map((c) => (
              <div key={c.id} className="glass-card flex items-center gap-3 p-2.5 pr-3 opacity-80">
                <span style={categoryStyle(c.color)} className="cat cat-soft w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ml-1">
                  <CategoryIcon categoryId={c.id} customIcon={c.icon} size={22} />
                </span>
                <span className="flex-1 text-sm font-medium text-foreground truncate">{c.label}</span>
                <button
                  onClick={() => restore.mutate(c.id, {
                    onSuccess: () => toast.success(`${c.label} is back`),
                    onError: (err) => toast.error(err.message),
                  })}
                  className="h-8 px-3 rounded-full bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-muted/80"
                >
                  <ArrowCounterClockwise size={14} weight="bold" /> Restore
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <CategoryEditorSheet
        open={creating || !!editing}
        category={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onDelete={(c) => { setEditing(null); setDeleting(c); }}
      />
      <DeleteCategoryDialog category={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
    </div>
  );
};

export default Categories;
