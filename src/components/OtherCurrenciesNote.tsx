import { formatMoney } from "@/lib/currencies";
import { cn } from "@/lib/utils";

/**
 * "+ €64.00 in other currencies". Totals only add up the main currency
 * (there are no exchange rates), so other currencies are listed next to them
 * instead of being silently mixed in, as v1 did.
 */
const OtherCurrenciesNote = ({ totals, className }: { totals: Record<string, number>; className?: string }) => {
  const entries = Object.entries(totals).filter(([, amount]) => amount > 0);
  if (entries.length === 0) return null;
  return (
    <p className={cn("text-xs text-muted-foreground font-body", className)}>
      + {entries.map(([code, amount]) => formatMoney(amount, code)).join(" · ")} in other {entries.length === 1 ? "currency" : "currencies"}
    </p>
  );
};

export default OtherCurrenciesNote;
