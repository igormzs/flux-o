export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "BRL", symbol: "R$", label: "Brazilian Real" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "CAD", symbol: "CA$", label: "Canadian Dollar" },
];

export const getCurrencySymbol = (code: string) => {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? `${code} `;
};

/** "$1,234.50". Same format v1 used everywhere, now in one place. */
export function formatMoney(amount: number, currency: string, opts: { decimals?: number } = {}) {
  const decimals = opts.decimals ?? 2;
  return (
    getCurrencySymbol(currency) +
    amount.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  );
}

/** An expense's currency; `null` in the database means the user's main currency. */
export function expenseCurrency(expense: { currency?: string | null }, mainCurrency: string) {
  return expense.currency ?? mainCurrency;
}

/**
 * Splits expenses into those in the main currency (which can be added up) and
 * totals for every other currency. There are no exchange rates, so v2 doesn't
 * mix currencies in one total. v1 did, which made €64 count as $64.
 */
export function splitByCurrency<T extends { amount: number; currency?: string | null }>(
  expenses: T[],
  mainCurrency: string,
) {
  const main: T[] = [];
  const others: Record<string, number> = {};
  for (const e of expenses) {
    const code = expenseCurrency(e, mainCurrency);
    if (code === mainCurrency) main.push(e);
    else others[code] = (others[code] ?? 0) + Number(e.amount);
  }
  return { main, others };
}

export function sumAmounts(expenses: { amount: number }[]) {
  return expenses.reduce((s, e) => s + Number(e.amount), 0);
}
