export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "BRL", symbol: "R$", label: "Brazilian Real" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "CAD", symbol: "CA$", label: "Canadian Dollar" },
];

export const getCurrencySymbol = (code: string) => {
  return CURRENCIES.find((c) => c.code === code)?.symbol || "$";
};

export const parseNote = (fullNote: string | null) => {
  if (!fullNote) return { currency: null, note: "" };
  const match = fullNote.match(/^\[([A-Z]{3})\]\s?(.*)$/);
  if (match) {
    return { currency: match[1], note: match[2] };
  }
  return { currency: null, note: fullNote };
};

export const stringifyNote = (currency: string | null, note: string) => {
  if (!currency) return note;
  return `[${currency}] ${note}`;
};
