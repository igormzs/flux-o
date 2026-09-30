import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CategoryIcon from "@/components/CategoryIcon";
import { categoryStyle, type CategoryInfo } from "@/lib/categories";
import { cn } from "@/lib/utils";

interface CategoryPickerProps {
  value: string;
  categories: CategoryInfo[];
  onChange: (id: string) => void;
  invalid?: boolean;
  label: string;
}

/** A category chip that opens the user's categories in their order. */
const CategoryPicker = ({ value, categories, onChange, invalid, label }: CategoryPickerProps) => {
  const [open, setOpen] = useState(false);
  const current = categories.find((c) => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${current?.label ?? "none"}`}
          style={current ? categoryStyle(current.color) : undefined}
          className={cn(
            "h-9 max-w-full px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-medium transition-colors",
            current ? "cat cat-tile" : "bg-muted text-muted-foreground border-dashed",
            invalid && !current && "border-destructive text-destructive",
          )}
        >
          {current ? <CategoryIcon categoryId={current.id} customIcon={current.icon} size={16} /> : null}
          <span className="truncate">{current?.label ?? "Category"}</span>
          <CaretDown size={12} weight="bold" className="shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 bg-card border-glass-border z-[70]">
        <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1.5 max-h-64 overflow-y-auto scrollbar-none">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === value}
              onClick={() => { onChange(c.id); setOpen(false); }}
              style={categoryStyle(c.color)}
              className={cn("cat flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] font-medium", c.id === value ? "cat-solid" : "cat-tile")}
            >
              <CategoryIcon categoryId={c.id} customIcon={c.icon} size={18} />
              <span className="truncate w-full text-center">{c.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CategoryPicker;
