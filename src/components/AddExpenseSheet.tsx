import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Camera, CalendarBlank } from "@phosphor-icons/react";
import { DEFAULT_CATEGORIES, saveExpense, updateExpense, getCustomCategories, createCustomCategory, uploadExpenseImage, CustomCategory, Expense } from "@/lib/expenses";
import CategoryIcon from "./CategoryIcon";
import { toast } from "sonner";
import { format } from "date-fns";

const COLORS = ["mint", "teal", "lavender", "electric", "pink", "yellow", "peach", "coral"];

const PHOSPHOR_ICONS = [
  "Pizza", "ShoppingCart", "House", "Television", "BeerBottle", "Plug", "Gift", "AirplaneTilt",
  "Car", "Heart", "Star", "Coffee", "Dog", "Cat", "GameController", "MusicNote",
  "GraduationCap", "Barbell", "FirstAid", "Scissors", "PaintBrush", "Wrench",
  "Phone", "Laptop", "Book", "Briefcase", "ShoppingBag", "Baby",
];

const colorBgMap: Record<string, string> = {
  mint: "bg-mint/20 border-mint/30 text-mint",
  teal: "bg-teal/20 border-teal/30 text-teal",
  lavender: "bg-lavender/20 border-lavender/30 text-lavender",
  electric: "bg-electric/20 border-electric/30 text-electric",
  pink: "bg-pink/20 border-pink/30 text-pink",
  yellow: "bg-yellow/20 border-yellow/30 text-yellow",
  peach: "bg-peach/20 border-peach/30 text-peach",
  coral: "bg-coral/20 border-coral/30 text-coral",
};

const selectedMap: Record<string, string> = {
  mint: "bg-mint text-primary-foreground",
  teal: "bg-teal text-primary-foreground",
  lavender: "bg-lavender text-primary-foreground",
  electric: "bg-electric text-primary-foreground",
  pink: "bg-pink text-primary-foreground",
  yellow: "bg-yellow text-primary-foreground",
  peach: "bg-peach text-primary-foreground",
  coral: "bg-coral text-primary-foreground",
};

interface AddExpenseSheetProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  expense?: Expense | null;
}

const AddExpenseSheet = ({ open, onClose, onAdded, expense }: AddExpenseSheetProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("Star");
  const [newCatColor, setNewCatColor] = useState("mint");

  useEffect(() => {
    if (open) {
      getCustomCategories().then(setCustomCategories).catch(console.error);
      
      if (expense) {
        setTitle(expense.title);
        setDescription(expense.note || "");
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
        setCategory("");
        setDate(format(new Date(), "yyyy-MM-dd"));
        setImageFile(null);
        setImagePreview(null);
      }
    }
  }, [open, expense]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatLabel.trim()) return;
    try {
      const cat = await createCustomCategory({ label: newCatLabel.trim(), icon: newCatIcon, color: newCatColor });
      setCustomCategories((prev) => [...prev, cat]);
      setCategory(cat.id);
      setShowNewCategory(false);
      setNewCatLabel("");
      toast.success("Category created!");
    } catch (err) {
      toast.error((err as Error).message);
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

      const payload = {
        title: title.trim(),
        amount: parseFloat(amount),
        category,
        note: description.trim() || undefined,
        date: new Date(date).toISOString(),
        image_url: imageUrl,
      };

      if (expense) {
        await updateExpense(expense.id, payload);
        toast.success("Expense updated!");
      } else {
        await saveExpense(payload);
        toast.success("Expense added!");
      }

      setTitle("");
      setDescription("");
      setAmount("");
      setCategory("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setImageFile(null);
      setImagePreview(null);
      onAdded();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const allCategories = [
    ...DEFAULT_CATEGORIES.map((c) => ({ ...c, isCustom: false })),
    ...customCategories.map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: c.color, isCustom: true })),
  ];

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
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-glass-border rounded-t-3xl p-6 pb-10 max-h-[90vh] overflow-auto scrollbar-none overflow-x-hidden touch-pan-y max-w-xl mx-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-xl text-foreground">
                {expense ? "Edit Expense" : "Add Expense"}
              </h2>
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
                className="w-full h-11 rounded-xl bg-muted border-none px-4 text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 text-sm"
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
                className="w-full rounded-xl bg-muted border-none px-4 py-3 text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
              />
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label htmlFor="amount" className="text-sm text-muted-foreground mb-1.5 block">Amount</label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-display font-bold text-muted-foreground">$</span>
                <input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-transparent text-3xl font-display font-bold text-foreground outline-none w-full placeholder:text-muted-foreground/30"
                />
              </div>
            </div>

            {/* Date */}
            <div className="mb-4">
              <label htmlFor="date" className="text-sm text-muted-foreground mb-1.5 block">Date</label>
              <div className="relative">
                <CalendarBlank size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 rounded-xl bg-muted border-none pl-10 pr-4 text-foreground outline-none focus:ring-2 focus:ring-primary/30 text-sm [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3"
                />
              </div>
            </div>

            {/* Image */}
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-1.5 block">Receipt / Image</label>
              {imagePreview ? (
                <div className="relative w-full h-32 rounded-xl overflow-hidden">
                  <img src={imagePreview} alt="Receipt" className="w-full h-full object-cover" />
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
              <label className="text-sm text-muted-foreground mb-2 block">Category</label>
              <div className="grid grid-cols-4 gap-2">
                {allCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all duration-200 text-xs ${
                      category === cat.id ? selectedMap[cat.color] : colorBgMap[cat.color]
                    }`}
                  >
                    <CategoryIcon categoryId={cat.isCustom ? "__custom__" : cat.id} customIcon={cat.icon} size={22} />
                    <span className="font-medium truncate w-full text-center text-[10px]">{cat.label}</span>
                  </button>
                ))}
                {/* Add new category button */}
                <button
                  onClick={() => setShowNewCategory(true)}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
                >
                  <Plus size={22} />
                  <span className="text-[10px] font-medium">New</span>
                </button>
              </div>
            </div>

            {/* New category form */}
            <AnimatePresence>
              {showNewCategory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="glass-card p-4 space-y-3">
                    <h4 className="font-display font-bold text-sm text-foreground">New Category</h4>
                    <label htmlFor="new-cat-label" className="sr-only">New Category Name</label>
                    <input
                      id="new-cat-label"
                      type="text"
                      placeholder="Category name"
                      value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      className="w-full h-10 rounded-lg bg-muted border-none px-3 text-foreground placeholder:text-muted-foreground/40 outline-none text-sm"
                    />
                    {/* Icon picker */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Icon</label>
                      <div className="flex flex-wrap gap-1.5">
                        {PHOSPHOR_ICONS.map((icon) => (
                          <button
                            key={icon}
                            onClick={() => setNewCatIcon(icon)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all ${
                              newCatIcon === icon ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <CategoryIcon categoryId="__custom__" customIcon={icon} size={16} />
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Color picker */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Color</label>
                      <div className="flex gap-2">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setNewCatColor(c)}
                            className={`w-7 h-7 rounded-full transition-all ${
                              newCatColor === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
                            }`}
                            style={{ backgroundColor: `hsl(var(--${c}))` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowNewCategory(false)}
                        className="flex-1 h-9 rounded-lg bg-muted text-muted-foreground text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateCategory}
                        disabled={!newCatLabel.trim()}
                        className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
        </>
      )}
    </AnimatePresence>
  );
};

export default AddExpenseSheet;
