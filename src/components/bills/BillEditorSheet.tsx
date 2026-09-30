import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import CategoryPicker from "@/components/add/CategoryPicker";
import { Switch } from "@/components/ui/switch";
import { CURRENCIES } from "@/lib/currencies";
import { allCategories } from "@/lib/categories";
import { ordinal, recurringErrors, type RecurringExpense } from "@/lib/recurring";
import { useCustomCategories, useRecurringMutations } from "@/hooks/useExpenses";

interface BillEditorSheetProps {
  open: boolean;
  onClose: () => void;
  /** The recurring expense to edit; omit to create one. */
  bill?: RecurringExpense | null;
  mainCurrency: string;
}

const field = "w-full h-11 rounded-xl bg-muted border-none px-4 text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 text-base md:text-sm";

/** Create or edit a recurring expense: name, usual amount, day of the month, category. */
const BillEditorSheet = ({ open, onClose, bill, mainCurrency }: BillEditorSheetProps) => {
  const { data: rows = [] } = useCustomCategories();
  const categories = allCategories(rows);
  const { create, update, remove } = useRecurringMutations();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(mainCurrency);
  const [day, setDay] = useState("1");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState(true);
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setConfirmDelete(false);
    setTitle(bill?.title ?? "");
    setAmount(bill ? Number(bill.amount).toFixed(2) : "");
    setCurrency(bill?.currency ?? mainCurrency);
    setDay(String(bill?.day_of_month ?? new Date().getDate()));
    setCategory(bill?.category ?? "");
    setActive(bill?.active ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the sheet opens
  }, [open, bill?.id]);

  const errors = recurringErrors({ title, amount, category: categories.some((c) => c.id === category) ? category : "", day });
  const saving = create.isPending || update.isPending || remove.isPending;

  const handleSave = async () => {
    setTouched(true);
    if (errors.length || saving) return;
    const input = {
      title: title.trim(),
      amount: Number(amount.replace(",", ".")),
      currency: currency === mainCurrency ? null : currency,
      category,
      day_of_month: Number(day),
      active,
    };
    try {
      if (bill) await update.mutateAsync({ id: bill.id, patch: input });
      else await create.mutateAsync(input);
      toast.success(bill ? "Saved" : `“${input.title}” added`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!bill) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await remove.mutateAsync(bill.id);
      toast.success(`“${bill.title}” deleted. Its past expenses are kept.`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const dayNumber = Number(day);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[60]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bill-editor-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-card border-t border-glass-border rounded-t-3xl p-6 pb-10 max-h-[88vh] overflow-auto scrollbar-none overflow-x-hidden touch-pan-y max-w-xl mx-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 id="bill-editor-title" className="font-display font-bold text-xl text-foreground">
                {bill ? "Edit recurring expense" : "New recurring expense"}
              </h2>
              <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="mb-4">
              <label htmlFor="bill-title" className="text-sm text-muted-foreground mb-1.5 block">Name</label>
              <input id="bill-title" type="text" autoComplete="off" maxLength={60} placeholder="e.g. Rent, Electricity, Netflix" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-1">
              <div>
                <label htmlFor="bill-amount" className="text-sm text-muted-foreground mb-1.5 block">Usual amount</label>
                <div className="flex items-center h-11 rounded-xl bg-muted focus-within:ring-2 focus-within:ring-primary/30">
                  <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-full bg-transparent pl-3 pr-1 text-base md:text-sm font-bold text-muted-foreground outline-none appearance-none cursor-pointer">
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol}</option>)}
                  </select>
                  <input id="bill-amount" type="text" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 min-w-0 h-full bg-transparent px-2 text-base md:text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground/40" />
                </div>
              </div>
              <div>
                <label htmlFor="bill-day" className="text-sm text-muted-foreground mb-1.5 block">Day of the month</label>
                <input id="bill-day" type="number" inputMode="numeric" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} className={field} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              {dayNumber >= 1 && dayNumber <= 31 ? `Asked for on the ${ordinal(dayNumber)} of each month` : "Pick a day from 1 to 31"}
              {dayNumber > 28 && dayNumber <= 31 ? " (the last day in shorter months)" : ""}. The amount can be changed every time you confirm it.
            </p>

            <div className="mb-5">
              <p className="text-sm text-muted-foreground mb-1.5">Category</p>
              <CategoryPicker value={category} categories={categories} onChange={setCategory} invalid={touched} label="Category" />
            </div>

            {bill && (
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-foreground text-sm font-medium">Active</p>
                  <p className="text-muted-foreground text-xs">Turn off to pause it without deleting</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} aria-label="Active" />
              </div>
            )}

            <p role="status" className="min-h-5 text-xs text-destructive mb-3">{touched && errors.length ? errors.join(" · ") : ""}</p>

            <div className="flex gap-2">
              {bill && (
                <button type="button" onClick={handleDelete} disabled={saving} className="h-12 px-4 rounded-2xl bg-destructive/10 text-destructive font-medium text-sm flex items-center gap-2 hover:bg-destructive/15 transition-colors">
                  <Trash size={18} weight="bold" />
                  {confirmDelete ? "Tap again to delete" : "Delete"}
                </button>
              )}
              <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={handleSave} disabled={saving} className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-base disabled:opacity-30 transition-opacity">
                {saving ? "Saving…" : bill ? "Save Changes" : "Add"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BillEditorSheet;
