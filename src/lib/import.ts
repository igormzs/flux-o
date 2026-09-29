import { format, subDays } from "date-fns";
import type { CategoryInfo } from "./categories";
import { CURRENCIES } from "./currencies";

/**
 * Phase 2, fast backfill: turns pasted notes, bank statements and CSV files
 * into draft expenses the user reviews before saving. Everything here is pure
 * and unit-tested; the /add screen only renders and saves the drafts.
 */

export interface Draft {
  /** Stable React key. */
  key: string;
  /** Local calendar day, yyyy-MM-dd. */
  date: string;
  title: string;
  /** As typed, e.g. "3,50"; parsed on save. */
  amount: string;
  /** Category id, or "" when none is picked yet. */
  category: string;
  currency: string;
  /** Unticked drafts are kept on screen but not saved. */
  include: boolean;
  /** Why the category was filled in automatically, for the hint under the row. */
  categoryHint?: "history" | "name" | "keyword" | "file" | "carried" | null;
  /** A likely duplicate of an existing expense (or of an earlier draft). */
  duplicate?: { title: string; date: string } | null;
}

let seq = 0;
export const newKey = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

/** A blank row. A category carried over from the row above is only a fallback: a guess from the title replaces it. */
export const emptyDraft = (date: string, currency: string, category = ""): Draft => ({
  key: newKey(), date, title: "", amount: "", category, currency, include: true, categoryHint: category ? "carried" : null,
});

// ── Amounts ─────────────────────────────────────────────────────────────────

// Longest first, so "R$" and "CA$" win over "$".
const SYMBOLS = CURRENCIES.map((c) => [c.symbol, c.code] as const).sort((a, b) => b[0].length - a[0].length);
const CODES = new Set(CURRENCIES.map((c) => c.code));

/**
 * "12.50", "3,50", "1.234,56", "1,234.56", "-€12.50", "(12.50)", "12.50 EUR".
 * A single separator followed by exactly three digits is a thousands
 * separator (1,234 → 1234); otherwise it's the decimal point (3,50 → 3.5).
 */
export function parseAmount(raw: string): { value: number; currency: string | null } | null {
  let s = raw.trim();
  if (!s) return null;
  let currency: string | null = null;
  const code = s.match(/\b([A-Z]{3})\b/);
  if (code && CODES.has(code[1])) {
    currency = code[1];
    s = s.replace(code[0], "");
  } else {
    for (const [sym, c] of SYMBOLS) {
      if (s.includes(sym)) {
        currency = c;
        s = s.replace(sym, "");
        break;
      }
    }
  }
  s = s.replace(/\s/g, "");
  const negative = /^[-−]|^\(.*\)$|-$/.test(s);
  s = s.replace(/[()\-−+]/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    normalized = s.split(thou).join("").replace(dec, ".");
  } else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
    if (!sep) normalized = s;
    else {
      const parts = s.split(sep);
      const thousands = parts.length > 2 || parts[parts.length - 1].length === 3;
      normalized = thousands ? parts.join("") : parts.join(".");
    }
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return { value: negative ? -value : value, currency };
}

// ── Dates ───────────────────────────────────────────────────────────────────

export type DateOrder = "dmy" | "mdy";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const ymd = (y: number, m: number, d: number) => {
  const dt = new Date(y, m - 1, d);
  // Reject 31/02 and friends instead of rolling over.
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return format(dt, "yyyy-MM-dd");
};

/** A date without a year is this year's, unless that would be in the future. */
function withoutYear(m: number, d: number, now: Date) {
  const thisYear = ymd(now.getFullYear(), m, d);
  if (thisYear && thisYear <= format(now, "yyyy-MM-dd")) return thisYear;
  return ymd(now.getFullYear() - 1, m, d);
}

const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/**
 * One date as written in a note or a file: 2026-09-19, 19/09/2026, 9/19/26,
 * 19.09, 19 Sep, Sep 19, Saturday, sat, today, yesterday.
 * Numeric day/month order follows `order`.
 */
export function parseDate(raw: string, now: Date, order: DateOrder = "dmy"): string | null {
  const s = raw.trim().toLowerCase().replace(/,$/, "");
  if (!s) return null;
  if (s === "today") return format(now, "yyyy-MM-dd");
  if (s === "yesterday") return format(subDays(now, 1), "yyyy-MM-dd");
  // "sat", "Sat.", "saturday": the most recent such day, today included.
  const word = s.replace(/\.$/, "");
  const wd = word.length >= 3 ? WEEKDAYS.findIndex((w) => DAY_NAMES[w].startsWith(word)) : -1;
  if (wd >= 0) return format(subDays(now, (now.getDay() - wd + 7) % 7), "yyyy-MM-dd");

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[t\s].*)?$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    const [d, mo] = order === "dmy" ? [a, b] : [b, a];
    return m[3] ? ymd(fullYear(+m[3]), mo, d) : withoutYear(mo, d, now);
  }
  m = s.match(/^(\d{1,2})\s*([a-z]{3,})\.?(?:\s+(\d{2,4}))?$/) ?? null;
  if (m && MONTHS.includes(m[2].slice(0, 3))) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3)) + 1;
    return m[3] ? ymd(fullYear(+m[3]), mo, +m[1]) : withoutYear(mo, +m[1], now);
  }
  m = s.match(/^([a-z]{3,})\.?\s*(\d{1,2})(?:\s+(\d{2,4}))?$/);
  if (m && MONTHS.includes(m[1].slice(0, 3))) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3)) + 1;
    return m[3] ? ymd(fullYear(+m[3]), mo, +m[2]) : withoutYear(mo, +m[2], now);
  }
  return null;
}

const DAY_NAMES: Record<string, string> = {
  sun: "sunday", mon: "monday", tue: "tuesday", wed: "wednesday", thu: "thursday", fri: "friday", sat: "saturday",
};

/**
 * Day-first or month-first, from the dates themselves: any first number above
 * 12 means day-first, any second number above 12 means month-first. Null when
 * every date is ambiguous (e.g. 05/06).
 */
export function detectDateOrder(samples: string[]): DateOrder | null {
  let dmy = false;
  let mdy = false;
  for (const s of samples) {
    const m = s.trim().match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.]\d{2,4})?$/);
    if (!m) continue;
    if (+m[1] > 12) dmy = true;
    if (+m[2] > 12) mdy = true;
  }
  if (dmy && !mdy) return "dmy";
  if (mdy && !dmy) return "mdy";
  return null;
}

// ── Free-text notes ─────────────────────────────────────────────────────────

export interface ParseResult {
  drafts: Draft[];
  /** Incoming money in a bank export (skipped, not an expense). */
  skippedIncome: number;
  /** Lines or rows that had nothing usable in them. */
  skippedInvalid: number;
  /** True when the dates couldn't tell day-first from month-first. */
  ambiguousDates: boolean;
  format: "lines" | "table";
}

export interface ParseContext {
  now: Date;
  currency: string;
  /** Used when the text doesn't say, or can't tell. */
  dateOrder?: DateOrder;
  /** For lines without a date. */
  defaultDate?: string;
}

/**
 * One expense per line, the way people jot them down:
 *   "Fri dinner with Ana 45", "Sat groceries 62,30", "19/09 Uber €12.40",
 *   "Coffee 3.50" (no date: the default date).
 * The date is the first word or two, the amount is the last number.
 */
export function parseLines(text: string, ctx: ParseContext): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const firstWords = lines.map((l) => l.split(/\s+/)[0]);
  const detected = detectDateOrder(firstWords);
  const order = ctx.dateOrder ?? detected ?? "dmy";
  const drafts: Draft[] = [];
  let skippedInvalid = 0;
  for (const line of lines) {
    let words = line.replace(/^[-*•]\s*/, "").split(/\s+/);
    let date: string | null = null;
    for (const n of [2, 1]) {
      if (words.length > n && (date = parseDate(words.slice(0, n).join(" "), ctx.now, order))) {
        words = words.slice(n);
        break;
      }
    }
    // Amount: the last word, or the last two when one is a currency ("€ 12", "12.40 EUR").
    let amount: ReturnType<typeof parseAmount> = null;
    const [prev, last] = [words[words.length - 2], words[words.length - 1]];
    if (prev && (/^([$€£¥]|R\$|CA\$)$/.test(prev) || CODES.has(last)) && (amount = parseAmount(`${prev} ${last}`))) {
      words = words.slice(0, -2);
    } else if (last && (amount = parseAmount(last))) {
      words = words.slice(0, -1);
    }
    const title = words.join(" ").replace(/^[-–:,\s]+|[-–:,\s]+$/g, "");
    if (!title && !amount) {
      skippedInvalid++;
      continue;
    }
    drafts.push({
      key: newKey(),
      date: date ?? ctx.defaultDate ?? format(ctx.now, "yyyy-MM-dd"),
      title: capitalize(title),
      amount: amount ? Math.abs(amount.value).toFixed(2) : "",
      category: "",
      currency: amount?.currency ?? ctx.currency,
      include: true,
    });
  }
  const numericDates = firstWords.some((w) => /^\d{1,2}[-/.]\d{1,2}([-/.]\d{2,4})?$/.test(w));
  return { drafts, skippedIncome: 0, skippedInvalid, ambiguousDates: !ctx.dateOrder && detected === null && numericDates, format: "lines" };
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ── Tables (CSV, TSV, spreadsheets, bank exports) ───────────────────────────

/** The delimiter that splits the first lines into the same number (≥2) of columns. */
export function detectDelimiter(text: string): string | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8);
  if (lines.length < 2) return null;
  let best: { delim: string; cols: number } | null = null;
  for (const delim of ["\t", ";", ","]) {
    const counts = lines.map((l) => splitRow(l, delim).length);
    const consistent = counts.every((c) => c === counts[0]);
    if (consistent && counts[0] >= 2 && (!best || counts[0] > best.cols)) best = { delim, cols: counts[0] };
  }
  return best?.delim ?? null;
}

/** One CSV row, with "quoted, fields" and "" escapes. */
function splitRow(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const HEADERS: Record<string, RegExp> = {
  date: /^(date|data|fecha|datum|day|posted|booking date|transaction date|value date|data (do )?movimento|data valor)$/i,
  title: /^(description|desc|merchant|payee|name|title|details|memo|narrative|descri[cç][aã]o|concepto|reference|transaction|movimento)$/i,
  amount: /^(amount|value|valor|importe|betrag|montant|sum|total|montante)$/i,
  debit: /^(debit|debito|débito|withdrawal|withdrawals|money out|paid out|out)$/i,
  credit: /^(credit|credito|crédito|deposit|deposits|money in|paid in|in)$/i,
  category: /^(category|categoria|categoría)$/i,
  currency: /^(currency|moeda|ccy|divisa)$/i,
};
type Field = keyof typeof HEADERS;

export function parseTable(text: string, delim: string, ctx: ParseContext): ParseResult {
  const rows = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => splitRow(l, delim));
  const header = rows[0];
  const hasHeader = header.every((c) => !parseAmount(c) && !parseDate(c, ctx.now)) && header.some((c) => /[a-z]/i.test(c));
  const data = hasHeader ? rows.slice(1) : rows;
  const col: Partial<Record<Field, number>> = {};
  if (hasHeader) {
    header.forEach((h, i) => {
      const name = h.trim().replace(/\s*\(.*\)$/, "");
      for (const f of Object.keys(HEADERS) as Field[]) if (col[f] === undefined && HEADERS[f].test(name)) col[f] = i;
    });
  }
  // Fill what the header didn't say from the values: mostly dates, mostly money, longest text.
  const share = (i: number, test: (v: string) => boolean) => data.filter((r) => r[i] && test(r[i])).length / Math.max(1, data.length);
  const width = Math.max(...rows.map((r) => r.length));
  const taken = () => new Set(Object.values(col));
  if (col.date === undefined) {
    for (let i = 0; i < width; i++) if (!taken().has(i) && share(i, (v) => !!parseDate(v, ctx.now)) > 0.6) { col.date = i; break; }
  }
  if (col.amount === undefined && col.debit === undefined) {
    for (let i = width - 1; i >= 0; i--) if (!taken().has(i) && share(i, (v) => !!parseAmount(v)) > 0.6) { col.amount = i; break; }
  }
  if (col.title === undefined) {
    let best = -1;
    let bestLen = 0;
    for (let i = 0; i < width; i++) {
      if (taken().has(i)) continue;
      const len = data.reduce((s, r) => s + (r[i]?.length ?? 0), 0);
      if (len > bestLen) { best = i; bestLen = len; }
    }
    if (best >= 0) col.title = best;
  }

  const dateSamples = col.date !== undefined ? data.map((r) => r[col.date!] ?? "") : [];
  const detected = detectDateOrder(dateSamples);
  const order = ctx.dateOrder ?? detected ?? "dmy";
  // A column with both signs is a bank statement: negatives are spending, positives are income.
  const signed = col.amount !== undefined ? data.map((r) => parseAmount(r[col.amount!] ?? "")?.value ?? 0) : [];
  const mixedSigns = signed.some((v) => v < 0) && signed.some((v) => v > 0);

  const drafts: Draft[] = [];
  let skippedIncome = 0;
  let skippedInvalid = 0;
  for (const r of data) {
    let amount: ReturnType<typeof parseAmount> = null;
    if (col.debit !== undefined) {
      amount = parseAmount(r[col.debit] ?? "");
      if (!amount || amount.value === 0) {
        if (col.credit !== undefined && parseAmount(r[col.credit] ?? "")) { skippedIncome++; continue; }
        amount = null;
      }
    } else if (col.amount !== undefined) {
      amount = parseAmount(r[col.amount] ?? "");
      if (amount && mixedSigns && amount.value > 0) { skippedIncome++; continue; }
    }
    const date = col.date !== undefined ? parseDate(r[col.date] ?? "", ctx.now, order) : null;
    const title = col.title !== undefined ? (r[col.title] ?? "").replace(/\s+/g, " ").trim() : "";
    if (!amount && !title) { skippedInvalid++; continue; }
    const code = col.currency !== undefined ? (r[col.currency] ?? "").toUpperCase() : "";
    drafts.push({
      key: newKey(),
      date: date ?? ctx.defaultDate ?? format(ctx.now, "yyyy-MM-dd"),
      title: capitalize(title),
      amount: amount ? Math.abs(amount.value).toFixed(2) : "",
      // The file's own category name, matched to a real category later.
      category: col.category !== undefined ? (r[col.category] ?? "") : "",
      categoryHint: col.category !== undefined && r[col.category] ? "file" : null,
      currency: CODES.has(code) ? code : amount?.currency ?? ctx.currency,
      include: true,
    });
  }
  return {
    drafts,
    skippedIncome,
    skippedInvalid,
    ambiguousDates: !ctx.dateOrder && detected === null && dateSamples.some((s) => /^\d{1,2}[-/.]\d{1,2}/.test(s.trim())),
    format: "table",
  };
}

/** Pasted text or a file's contents: a table if it has one, otherwise one expense per line. */
export function parseText(text: string, ctx: ParseContext): ParseResult {
  const delim = detectDelimiter(text);
  return delim ? parseTable(text, delim, ctx) : parseLines(text, ctx);
}

// ── Categories ──────────────────────────────────────────────────────────────

/** "Uber *Trip 4521" → "uber trip". */
export const normalizeTitle = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/** Words that point at one of the default categories (English + Portuguese). */
const KEYWORDS: Record<string, string[]> = {
  food: ["restaurant", "dinner", "lunch", "breakfast", "brunch", "pizza", "burger", "sushi", "takeaway", "ubereats", "uber eats", "glovo", "deliveroo", "bolt food", "cafe", "bakery", "jantar", "almoco", "restaurante"],
  grocery: ["groceries", "grocery", "supermarket", "market", "lidl", "aldi", "continente", "pingo doce", "mercadona", "carrefour", "auchan", "tesco", "whole foods", "minipreco", "supermercado", "mercado"],
  rent: ["rent", "landlord", "renda", "aluguel", "mortgage"],
  subscriptions: ["netflix", "spotify", "disney", "hbo", "prime video", "youtube premium", "icloud", "apple music", "subscription", "patreon", "chatgpt"],
  nightlife: ["bar", "pub", "beer", "beers", "drinks", "club", "cocktail", "cocktails", "wine", "cerveja"],
  utilities: ["electricity", "water bill", "gas bill", "internet", "wifi", "phone bill", "mobile", "vodafone", "meo", "nos", "edp", "luz", "agua"],
  selfcare: ["haircut", "barber", "salon", "pharmacy", "farmacia", "skincare", "massage", "spa", "cosmetics"],
  travel: ["flight", "airline", "ryanair", "easyjet", "tap", "hotel", "airbnb", "booking", "train", "cp", "comboio", "uber", "bolt", "taxi", "bus", "metro", "fuel", "petrol", "gas station", "galp", "toll", "parking", "trip"],
};

export interface HistoryItem {
  title: string;
  category: string;
}

/**
 * Best category for a title, in order of confidence:
 * 1. the category you used most for the same title before ("Lidl" → Grocery),
 * 2. a category whose name appears in the title ("Gym membership" → Gym),
 * 3. a keyword for a default category ("Uber to airport" → Travel).
 * Only visible categories are suggested.
 */
export function guessCategory(
  title: string,
  history: HistoryItem[],
  categories: CategoryInfo[],
): { id: string; hint: "history" | "name" | "keyword" } | null {
  const t = normalizeTitle(title);
  if (!t) return null;
  const visible = new Set(categories.map((c) => c.id));
  const counts = new Map<string, number>();
  for (const h of history) if (visible.has(h.category) && normalizeTitle(h.title) === t) counts.set(h.category, (counts.get(h.category) ?? 0) + 1);
  if (counts.size) return { id: [...counts].sort((a, b) => b[1] - a[1])[0][0], hint: "history" };

  const words = ` ${t} `;
  const byName = categories.find((c) => {
    const label = normalizeTitle(c.label);
    return label && forms(label).some((f) => words.includes(` ${f} `));
  });
  if (byName) return { id: byName.id, hint: "name" };

  for (const [id, keys] of Object.entries(KEYWORDS)) {
    if (visible.has(id) && keys.some((k) => words.includes(` ${k} `))) return { id, hint: "keyword" };
  }
  return null;
}

/** "grocery" → ["grocery", "grocerys", "groceries"], so plurals match too. */
const forms = (label: string) => [label, `${label}s`, label.replace(/y$/, "ies")];

/** Matches a file's category text ("Groceries") to a category id, or "" if none fits. */
export function matchCategoryName(name: string, categories: CategoryInfo[]): string {
  const n = normalizeTitle(name);
  if (!n) return "";
  const hit = categories.find((c) => {
    const l = normalizeTitle(c.label);
    return forms(l).includes(n) || forms(n).includes(l) || c.id === n;
  });
  return hit?.id ?? "";
}

// ── Duplicates ──────────────────────────────────────────────────────────────

export interface ExistingExpense {
  title: string;
  amount: number | string;
  date: string;
}

const sameMoney = (a: number, b: number) => Math.abs(a - b) < 0.005;
const similarTitles = (a: string, b: string) => {
  const [x, y] = [normalizeTitle(a), normalizeTitle(b)];
  return !x || !y || x === y || x.includes(y) || y.includes(x);
};

/**
 * Flags drafts that look like an expense already saved (same day, same
 * amount, similar title) or like an earlier draft in the same batch, and
 * unticks them so re-importing a statement doesn't double-count.
 */
export function markDuplicates(drafts: Draft[], existing: ExistingExpense[]): Draft[] {
  const seen: Draft[] = [];
  return drafts.map((d) => {
    const amount = parseAmount(d.amount)?.value;
    let duplicate: Draft["duplicate"] = null;
    if (amount !== undefined) {
      const hit = existing.find((e) => format(new Date(e.date), "yyyy-MM-dd") === d.date && sameMoney(Number(e.amount), amount) && similarTitles(e.title, d.title));
      const twin = seen.find((s) => s.date === d.date && sameMoney(parseAmount(s.amount)?.value ?? NaN, amount) && similarTitles(s.title, d.title));
      duplicate = hit ? { title: hit.title, date: d.date } : twin ? { title: `${twin.title} (above)`, date: d.date } : null;
    }
    seen.push(d);
    return duplicate ? { ...d, duplicate, include: false } : { ...d, duplicate: null };
  });
}

// ── Validation & saving ─────────────────────────────────────────────────────

export function draftErrors(d: Draft): string[] {
  const errors: string[] = [];
  if (!d.title.trim()) errors.push("Add a title");
  const a = parseAmount(d.amount);
  if (!a || a.value <= 0) errors.push("Add an amount");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) errors.push("Add a date");
  if (!d.category) errors.push("Pick a category");
  return errors;
}

/** The expense to insert: noon on the chosen day, so no time zone moves it to another date. */
export function draftToExpense(d: Draft) {
  const [y, m, day] = d.date.split("-").map(Number);
  return {
    title: d.title.trim(),
    amount: Math.abs(parseAmount(d.amount)!.value),
    category: d.category,
    currency: d.currency,
    date: new Date(y, m - 1, day, 12).toISOString(),
    note: null,
    image_url: null,
  };
}
