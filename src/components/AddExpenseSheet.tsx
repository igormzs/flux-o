import StoredImage from "./StoredImage";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Camera, CalendarBlank, SlidersHorizontal, Stack } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { uploadExpenseImage, Expense } from "@/lib/expenses";
import { allCategories, categoryStyle, resolveCategory } from "@/lib/categories";
import { CURRENCIES } from "@/lib/currencies";
import { useCustomCategories, useExpenseMutations } from "@/hooks/useExpenses";
import { useSettings } from "@/hooks/useProfile";
import CategoryIcon from "./CategoryIcon";
import CategoryEditorSheet from "./categories/CategoryEditorSheet";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AddExpenseSheetProps {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
  expense?: Expense | null;
}

const AddExpenseSheet = ({ open, onClose, onAdded, expense }: AddExpenseSheetProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();
  const { data: customCategories = [] } = useCustomCategories();
  const { save, update } = useExpenseMutations();
  const [showNewCategory, setShowNewCategory] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      const globalCurrency = settings.currency;

      if (expense) {
        setTitle(expense.title);
        setCurrency(expense.currency ?? globalCurrency);
        setDescription(expense.note ?? "");
        setAmount(expense.amount.toString());
        setCategory(expense.category);
        setDate(format(new Date(expense.date), "yyyy-MM-dd"));
        setImagePreview(expense.image_url);
        setImageFile(null); // Reset file upload
      } else {
        // Reset form for addition
        setTitle("");
        setDescription("");
        setAmount("");
        setCurrency(globalCurrency);
        setCategory("");
        setDate(format(new Date(), "yyyy-MM-dd"));
        setImageFile(null);
        setImagePreview(null);
      }
    }
  }, [open, expense, settings.currency]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!amount || !category || !title.trim()) return;
    setLoading(true);
    try {
      let imageUrl = imagePreview; // Re-use old image URL unless changed
      if (imageFile) {
        imageUrl = await uploadExpenseImage(imageFile);
      }

      const [y, m, d] = date.split("-").map(Number);
      const now = new Date();
      const baseDate = expense ? new Date(expense.date) : now;
      const finalDate = new Date(baseDate);
      finalDate.setFullYear(y, m - 1, d);
      
      // If it's a new expense and the date is today, use exactly "now" to keep time precise
      const isToday = date === format(now, "yyyy-MM-dd");
      const dateToSave = (!expense && isToday) ? now.toISOString() : finalDate.toISOString();

      const payload = {
        title: title.trim(),
        amount: parseFloat(amount),
        category,
        currency,
        note: description.trim() || null,
        date: dateToSave,
        image_url: imageUrl,
      };

      if (expense) {
        await update.mutateAsync({ id: expense.id, input: payload });
        toast.success("Expense updated!");
      } else {
        await save.mutateAsync(payload);
        toast.success("Expense added!");
      }

      setTitle("");
      setDescription("");
      setAmount("");
      setCategory("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setImageFile(null);
      setImagePreview(null);
      onAdded?.();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const categories = allCategories(customCategories);
  // An expense being edited may use a category that was hidden since; keep it selectable.
  if (category && !categories.some((c) => c.id === category)) categories.push(resolveCategory(category, customCategories));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-glass-border rounded-t-3xl p-6 pb-10 max-h-[82vh] overflow-auto scrollbar-none overflow-x-hidden touch-pan-y max-w-xl mx-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-xl text-foreground">
                {expense ? "Edit Expense" : "Add Expense"}
              </h2>
              {!expense && (
                <button
                  type="button"
                  data-testid="add-several"
                  onClick={() => { onClose(); navigate("/add"); }}
                  className="ml-auto mr-2 h-8 px-3 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center gap-1.5 hover:bg-primary/20"
                >
                  <Stack size={14} weight="bold" /> Add several
                </button>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label htmlFor="title" className="text-sm text-muted-foreground mb-1.5 block">Title</label>
              <input
                id="title"
                type="text"
                placeholder="What did you spend on?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-11 rounded-xl bg-muted border-none px-4 text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 text-base md:text-sm"
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label htmlFor="description" className="text-sm text-muted-foreground mb-1.5 block">Description <span className="text-muted-foreground/50">(optional)</span></label>
              <textarea
                id="description"
                placeholder="Add a note or description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl bg-muted border-none px-4 py-3 text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 text-base md:text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-[1fr_minmax(130px,0.5fr)] gap-4 mb-4">
              {/* Amount */}
              <div>
                <label htmlFor="amount" className="text-sm text-muted-foreground mb-1.5 block">Amount</label>
                <div className="flex items-center gap-2 bg-muted rounded-xl px-3 h-11 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm border border-glass-border hover:bg-white/90 transition-all active:scale-95 shrink-0"
                      >
                        <span className="text-slate-900 font-bold text-base">
                          {CURRENCIES.find(c => c.code === currency)?.symbol}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 bg-popover border-glass-border">
                      {CURRENCIES.map((c) => (
                        <DropdownMenuItem
                          key={c.code}
                          onClick={() => setCurrency(c.code)}
                          className="flex items-center justify-between cursor-pointer py-2.5"
                        >
                          <span className="text-sm font-medium">{c.label}</span>
                          <span className="text-xs text-muted-foreground font-bold">{c.symbol}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-lg font-display font-bold text-foreground outline-none w-full placeholder:text-muted-foreground/30 px-1"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label htmlFor="date" className="text-sm text-muted-foreground mb-1.5 block">Date</label>
                <div className="relative h-11">
                  <div className="absolute inset-0 flex items-center gap-2 bg-muted rounded-xl px-3 pointer-events-none transition-all">
                    <CalendarBlank size={18} className="text-muted-foreground" />
                    <span className="text-foreground text-sm font-medium">
                      {format(new Date(date + "T00:00:00"), "dd/MM/yy")}
                    </span>
                  </div>
                  <input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10 text-base"
                  />
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-1.5 block">Receipt / Image</label>
              {imagePreview ? (
                <div className="relative w-full h-32 rounded-xl overflow-hidden">
                  <StoredImage value={imagePreview} alt="Receipt" className="w-full h-full object-cover" fallback={<div className="w-full h-full bg-muted animate-pulse" />} />
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center"
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>
              ) : (
                <label htmlFor="receipt-upload" className="flex items-center gap-2 h-11 rounded-xl bg-muted px-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors text-sm">
                  <Camera size={18} />
                  <span>Add photo</span>
                  <input id="receipt-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>

            {/* Category grid */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-muted-foreground">Category</label>
                <button
                  type="button"
                  onClick={() => { onClose(); navigate("/categories"); }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <SlidersHorizontal size={14} /> Manage
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    data-testid={`category-${cat.id}`}
                    onClick={() => setCategory(cat.id)}
                    style={categoryStyle(cat.color)}
                    className={`cat flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all duration-200 text-xs ${
                      category === cat.id ? "cat-solid" : "cat-tile"
                    }`}
                  >
                    <CategoryIcon categoryId={cat.id} customIcon={cat.icon} size={22} />
                    <span className="font-medium truncate w-full text-center text-[10px]">{cat.label}</span>
                  </button>
                ))}
                {/* Add new category button */}
                <button
                  data-testid="new-category"
                  onClick={() => setShowNewCategory(true)}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
                >
                  <Plus size={22} />
                  <span className="text-[10px] font-medium">New</span>
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!amount || !category || !title.trim() || loading}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-lg disabled:opacity-30 transition-opacity"
            >
              {loading ? (expense ? "Saving..." : "Adding...") : (expense ? "Save Changes" : "Add Expense")}
            </motion.button>
          </motion.div>
          <CategoryEditorSheet
            open={showNewCategory}
            onClose={() => setShowNewCategory(false)}
            onSaved={(id) => setCategory(id)}
          />
        </>
      )}
    </AnimatePresence>
  );
};

export default AddExpenseSheet;
