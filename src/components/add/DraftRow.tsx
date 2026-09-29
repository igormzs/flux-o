import { format } from "date-fns";
import { Trash, Warning, Sparkle } from "@phosphor-icons/react";
import CategoryPicker from "./CategoryPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { CURRENCIES } from "@/lib/currencies";
import type { CategoryInfo } from "@/lib/categories";
import type { Draft } from "@/lib/import";
import { cn } from "@/lib/utils";

const HINTS: Record<string, string> = {
  history: "Category from your past expenses",
  name: "Category from the title",
  keyword: "Category guessed from the title",
  file: "Category from the file",
  carried: "",
};

interface DraftRowProps {
  draft: Draft;
  index: number;
  categories: CategoryInfo[];
  errors: string[];
  showErrors: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
  /** Enter in the amount field: go to the next row (adding one at the end). */
  onNext: () => void;
  onTitleBlur: () => void;
}

const DraftRow = ({ draft, index, categories, errors, showErrors, onChange, onRemove, onNext, onTitleBlur }: DraftRowProps) => {
  const n = index + 1;
  const invalid = showErrors && draft.include && errors.length > 0;
  return (
    <div
      data-testid="draft-row"
      className={cn(
        "glass-card p-3 transition-opacity",
        !draft.include && "opacity-55",
        invalid && "border-destructive/60",
      )}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          checked={draft.include}
          onCheckedChange={(v) => onChange({ include: v === true })}
          aria-label={`Include row ${n}`}
          className="shrink-0"
        />
        <input
          type="text"
          data-field="title"
          aria-label={`Title, row ${n}`}
          placeholder="What was it?"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          onBlur={onTitleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget.closest("[data-testid=draft-row]")?.querySelector("[data-field=amount]") as HTMLInputElement | null)?.focus();
            }
          }}
          className="flex-1 min-w-0 h-9 rounded-lg bg-muted px-3 text-base md:text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex items-center h-9 rounded-lg bg-muted focus-within:ring-2 focus-within:ring-primary/30 shrink-0">
          <select
            aria-label={`Currency, row ${n}`}
            value={draft.currency}
            onChange={(e) => onChange({ currency: e.target.value })}
            className="h-full bg-transparent pl-2 pr-0.5 text-base md:text-xs font-bold text-muted-foreground outline-none appearance-none cursor-pointer"
          >
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol}</option>)}
          </select>
          <input
            type="text"
            inputMode="decimal"
            data-field="amount"
            aria-label={`Amount, row ${n}`}
            placeholder="0.00"
            value={draft.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onNext();
              }
            }}
            className="w-20 h-full bg-transparent px-1.5 text-base md:text-sm font-bold text-foreground text-right outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 pl-6">
        <input
          type="date"
          aria-label={`Date, row ${n}`}
          value={draft.date}
          max={format(new Date(), "yyyy-MM-dd")}
          onChange={(e) => onChange({ date: e.target.value })}
          className="h-9 rounded-lg bg-muted px-2 text-base md:text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex-1 min-w-0">
          <CategoryPicker
            value={draft.category}
            categories={categories}
            onChange={(id) => onChange({ category: id, categoryHint: null })}
            invalid={invalid}
            label={`Category, row ${n}`}
          />
        </div>
        <button type="button" onClick={onRemove} aria-label={`Remove row ${n}`} className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
          <Trash size={16} />
        </button>
      </div>

      {(draft.duplicate || (draft.categoryHint && HINTS[draft.categoryHint] && draft.category) || invalid) && (
        <div className="pl-6 mt-2 space-y-1 text-[11px]">
          {draft.duplicate && (
            <p className="flex items-center gap-1 text-accent">
              <Warning size={12} weight="bold" /> Looks like “{draft.duplicate.title}” on {format(new Date(`${draft.duplicate.date}T00:00:00`), "MMM d")}, so it’s unticked.
            </p>
          )}
          {draft.categoryHint && HINTS[draft.categoryHint] && draft.category && !invalid && (
            <p className="flex items-center gap-1 text-muted-foreground"><Sparkle size={12} weight="fill" /> {HINTS[draft.categoryHint]}</p>
          )}
          {invalid && <p className="text-destructive">{errors.join(" · ")}</p>}
        </div>
      )}
    </div>
  );
};

export default DraftRow;
