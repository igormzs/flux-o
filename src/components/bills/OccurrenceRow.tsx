import { format } from "date-fns";
import { Check } from "@phosphor-icons/react";
import CategoryIcon from "@/components/CategoryIcon";
import { categoryStyle, type CategoryInfo } from "@/lib/categories";
import { getCurrencySymbol } from "@/lib/currencies";
import { parseBillAmount, type Occurrence } from "@/lib/recurring";

interface OccurrenceRowProps {
  occurrence: Occurrence;
  category: CategoryInfo;
  mainCurrency: string;
  /** The amount being edited, as typed. */
  amount: string;
  onAmountChange: (value: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
  disabled?: boolean;
  /** Leave out the icon and name (the Recurring expenses screen shows them above). */
  compact?: boolean;
}

const dueLabel = (o: Occurrence) => `Due ${format(new Date(`${o.dueDate}T00:00:00`), "MMM d")}`;

/** One bill to confirm: the amount (pre-filled, editable), Confirm and Skip. */
const OccurrenceRow = ({ occurrence: o, category, mainCurrency, amount, onAmountChange, onConfirm, onSkip, disabled, compact }: OccurrenceRowProps) => {
  const valid = parseBillAmount(amount) !== null;
  return (
    <div data-testid="bill-occurrence" className="flex items-center gap-2.5">
      {!compact && (
        <span style={categoryStyle(category.color)} className="cat cat-soft w-10 h-10 shrink-0 rounded-xl flex items-center justify-center">
          <CategoryIcon categoryId={category.id} customIcon={category.icon} size={20} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        {!compact && <p className="text-sm font-medium text-foreground truncate">{o.bill.title}</p>}
        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
          {dueLabel(o)}
          <button type="button" onClick={onSkip} disabled={disabled} aria-label={`Skip ${o.bill.title} this time`} className="ml-2 underline underline-offset-2 hover:text-foreground disabled:opacity-50">
            Skip
          </button>
        </p>
      </div>
      <div className="flex items-center h-10 rounded-xl bg-muted focus-within:ring-2 focus-within:ring-primary/30 shrink-0">
        <span className="pl-2.5 text-xs font-bold text-muted-foreground">{getCurrencySymbol(o.bill.currency ?? mainCurrency)}</span>
        <input
          type="text"
          inputMode="decimal"
          aria-label={`Amount for ${o.bill.title}`}
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && valid) onConfirm(); }}
          className="w-[4.75rem] h-full bg-transparent px-1.5 text-base md:text-sm font-bold text-foreground text-right outline-none"
        />
      </div>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled || !valid}
        aria-label={`Confirm ${o.bill.title}`}
        className="w-10 h-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
      >
        <Check size={18} weight="bold" />
      </button>
    </div>
  );
};

export default OccurrenceRow;
