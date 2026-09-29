import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { addDays, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ClipboardText, FileArrowUp, Keyboard, Plus, Info } from "@phosphor-icons/react";
import DraftRow from "@/components/add/DraftRow";
import { expenseKeys, useCustomCategories, useExpenseHistory, useExpenseMutations } from "@/hooks/useExpenses";
import { useSettings } from "@/hooks/useProfile";
import { allCategories } from "@/lib/categories";
import { formatMoney } from "@/lib/currencies";
import { getExpensesInRange } from "@/lib/expenses";
import {
  draftErrors,
  draftToExpense,
  emptyDraft,
  guessCategory,
  markDuplicates,
  matchCategoryName,
  parseAmount,
  parseText,
  type DateOrder,
  type Draft,
  type ParseResult,
} from "@/lib/import";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "fluxo_add_drafts";
const MAX_ROWS = 500;
const EXAMPLE = "Fri dinner with Ana 45\nSat groceries 62,30\nSat Uber home 12.40\nSun coffee 3.50";

const isBlank = (d: Draft) => !d.title.trim() && !d.amount.trim();
const today = () => format(new Date(), "yyyy-MM-dd");

function loadDrafts(): Draft[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Draft[]) : null;
    return parsed?.length ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Phase 2, fast backfill: add a weekend's worth of expenses in one go, by
 * typing rows (date and category carry over) or by pasting a note, a bank
 * statement or a CSV file. Everything is reviewed here, then saved in one
 * request, with Undo.
 */
const AddExpenses = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const { data: rows = [] } = useCustomCategories();
  const { data: history = [] } = useExpenseHistory();
  const { saveMany, removeMany } = useExpenseMutations();
  const categories = useMemo(() => allCategories(rows), [rows]);

  const [drafts, setDrafts] = useState<Draft[]>(() => loadDrafts() ?? [emptyDraft(today(), settings.currency)]);
  const [mode, setMode] = useState<"type" | "paste">("type");
  const [text, setText] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [lastRead, setLastRead] = useState<{ text: string; keys: string[]; result: ParseResult; order: DateOrder | null } | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep unsaved rows for this tab, so a stray Back doesn't lose a pasted statement.
  useEffect(() => {
    try {
      if (drafts.some((d) => !isBlank(d))) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode): the rows just aren't kept.
    }
  }, [drafts]);

  // New blank rows use the main currency once settings have loaded.
  useEffect(() => {
    setDrafts((ds) => ds.map((d) => (isBlank(d) ? { ...d, currency: settings.currency } : d)));
  }, [settings.currency]);

  useEffect(() => {
    if (!focusKey) return;
    listRef.current?.querySelector<HTMLInputElement>(`[data-key="${focusKey}"] [data-field=title]`)?.focus();
    setFocusKey(null);
  }, [focusKey, drafts]);

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const withGuess = (d: Draft): Draft => {
    if (d.categoryHint === "file") {
      const id = matchCategoryName(d.category, categories);
      if (id) return { ...d, category: id };
      d = { ...d, category: "", categoryHint: null };
    }
    // Keep a category the user picked; replace an empty or carried-over one with a guess.
    if (d.category && d.categoryHint !== "carried") return d;
    const g = guessCategory(d.title, history, categories);
    return g ? { ...d, category: g.id, categoryHint: g.hint } : d;
  };

  const addRow = (after?: Draft) => {
    const last = after ?? drafts[drafts.length - 1];
    // Carry the date and category over: a weekend's expenses share both often.
    const row = emptyDraft(last?.date ?? today(), last?.currency ?? settings.currency, last?.category ?? "");
    setDrafts((ds) => {
      const i = after ? ds.findIndex((d) => d.key === after.key) + 1 : ds.length;
      return [...ds.slice(0, i), row, ...ds.slice(i)];
    });
    setFocusKey(row.key);
  };

  const read = async (source: string, order: DateOrder | null = null, replaceKeys: string[] = []) => {
    const result = parseText(source, { now: new Date(), currency: settings.currency, dateOrder: order ?? undefined, defaultDate: today() });
    if (!result.drafts.length) {
      toast.error("Couldn’t find any expenses in that text.");
      return;
    }
    let found = result.drafts.slice(0, MAX_ROWS).map(withGuess);
    // Compare with what's already saved on those days, so a re-imported statement isn't counted twice.
    const days = found.map((d) => d.date).sort();
    const range = { start: new Date(`${days[0]}T00:00:00`), end: addDays(new Date(`${days[days.length - 1]}T00:00:00`), 1) };
    try {
      const existing = await queryClient.fetchQuery({ queryKey: expenseKeys.range(range), queryFn: () => getExpensesInRange(range) });
      found = markDuplicates(found, existing);
    } catch {
      found = markDuplicates(found, []);
    }
    setDrafts((ds) => [...ds.filter((d) => !isBlank(d) && !replaceKeys.includes(d.key)), ...found]);
    setLastRead({ text: source, keys: found.map((d) => d.key), result, order });
    setText("");
    setMode("type");
    setShowErrors(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("That file is too big (max 2 MB).");
      return;
    }
    await read(await file.text());
  };

  const included = drafts.filter((d) => d.include && !isBlank(d));
  const invalid = included.filter((d) => draftErrors(d).length);
  const totals = included.reduce<Record<string, number>>((acc, d) => {
    const a = parseAmount(d.amount);
    if (a && a.value > 0) acc[d.currency] = (acc[d.currency] ?? 0) + a.value;
    return acc;
  }, {});
  const totalText = Object.entries(totals)
    .sort(([a], [b]) => (a === settings.currency ? -1 : b === settings.currency ? 1 : a.localeCompare(b)))
    .map(([c, v]) => formatMoney(v, c))
    .join(" + ");

  const save = async () => {
    if (!included.length) return;
    if (invalid.length) {
      setShowErrors(true);
      toast.error(`${invalid.length} ${invalid.length === 1 ? "row needs" : "rows need"} a closer look`);
      listRef.current?.querySelector(`[data-key="${invalid[0].key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    try {
      const ids = await saveMany.mutateAsync(included.map(draftToExpense));
      setDrafts([emptyDraft(today(), settings.currency)]);
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* nothing to clear */ }
      toast.success(`${ids.length} ${ids.length === 1 ? "expense" : "expenses"} added`, {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () => removeMany.mutate(ids, {
            onSuccess: () => toast.success("Removed again"),
            onError: (err) => toast.error(err.message),
          }),
        },
      });
      navigate("/");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const summary = lastRead && (() => {
    const r = lastRead.result;
    const parts = [`Read ${r.drafts.length} ${r.drafts.length === 1 ? "expense" : "expenses"}`];
    if (r.skippedIncome) parts.push(`${r.skippedIncome} incoming ${r.skippedIncome === 1 ? "payment" : "payments"} skipped`);
    const dupes = drafts.filter((d) => lastRead.keys.includes(d.key) && d.duplicate).length;
    if (dupes) parts.push(`${dupes} possible ${dupes === 1 ? "duplicate" : "duplicates"} unticked`);
    if (r.skippedInvalid) parts.push(`${r.skippedInvalid} ${r.skippedInvalid === 1 ? "line" : "lines"} ignored`);
    return parts.join(" · ");
  })();

  return (
    <div className="min-h-screen bg-background pb-44 px-5 sm:px-8 pt-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 mb-1">
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} weight="bold" />
        </button>
        <h2 className="font-display font-bold text-2xl text-foreground">Add expenses</h2>
      </motion.div>
      <p className="text-xs text-muted-foreground mb-5 pl-12">Catch up on several at once: type them, or paste a note, a statement or a CSV.</p>

      <div role="tablist" aria-label="How to add" className="grid grid-cols-2 p-1 rounded-full bg-muted border border-glass-border mb-4">
        {([["type", "Type", Keyboard], ["paste", "Paste or import", ClipboardText]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            data-testid={`mode-${id}`}
            onClick={() => setMode(id)}
            className={cn("flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-display font-semibold transition-colors", mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Icon size={16} weight="bold" /> {label}
          </button>
        ))}
      </div>

      {mode === "paste" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 mb-5">
          <label htmlFor="paste-box" className="text-sm text-muted-foreground mb-2 block">One expense per line, or a table copied from your bank or a spreadsheet</label>
          <textarea
            id="paste-box"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            className="w-full rounded-xl bg-muted px-4 py-3 font-mono text-base md:text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          />
          <p className="flex gap-1.5 text-[11px] text-muted-foreground mt-2 mb-3">
            <Info size={14} className="shrink-0 mt-px" />
            A day (“Sat”, “19/09”, “yesterday”) at the start and the amount at the end. Tables need a date, a description and an amount; incoming money is skipped.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => read(text.trim() || EXAMPLE)}
              data-testid="read-text"
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
            >
              {text.trim() ? "Read expenses" : "Try the example"}
            </button>
            <label className="h-10 px-4 rounded-xl bg-muted text-foreground text-sm font-medium flex items-center gap-2 cursor-pointer hover:bg-muted/80">
              <FileArrowUp size={16} /> Choose a CSV file
              <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
        </motion.div>
      )}

      {summary && (
        <div role="status" className="rounded-xl bg-primary/10 text-primary text-xs px-3 py-2 mb-3 space-y-1.5" data-testid="read-summary">
          <p>{summary}. Check them below, then save.</p>
          {lastRead!.result.ambiguousDates && (
            <p className="flex flex-wrap items-center gap-2 text-foreground">
              Dates like 05/06 could be either way. Read them as
              {(["dmy", "mdy"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => read(lastRead!.text, o, lastRead!.keys)}
                  className={cn("px-2 py-0.5 rounded-full border", (lastRead!.order ?? "dmy") === o ? "bg-primary text-primary-foreground border-primary" : "border-glass-border")}
                >
                  {o === "dmy" ? "day/month" : "month/day"}
                </button>
              ))}
            </p>
          )}
        </div>
      )}

      <div ref={listRef} className="space-y-2">
        {drafts.map((d, i) => (
          <div key={d.key} data-key={d.key}>
            <DraftRow
              draft={d}
              index={i}
              categories={categories}
              errors={draftErrors(d)}
              showErrors={showErrors}
              onChange={(patch) => update(d.key, patch)}
              onRemove={() => setDrafts((ds) => (ds.length > 1 ? ds.filter((x) => x.key !== d.key) : [emptyDraft(today(), settings.currency)]))}
              onNext={() => (i === drafts.length - 1 ? addRow(d) : setFocusKey(drafts[i + 1].key))}
              onTitleBlur={() => (!d.category || d.categoryHint === "carried") && d.title.trim() && update(d.key, withGuess(d))}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => addRow()}
        disabled={drafts.length >= MAX_ROWS}
        data-testid="add-row"
        className="mt-3 w-full h-11 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground text-sm flex items-center justify-center gap-1.5 hover:text-foreground hover:border-primary/50"
      >
        <Plus size={16} weight="bold" /> Add row
      </button>

      {/* Sticky save bar, above the bottom navigation on phones. */}
      <div className="fixed left-0 md:left-64 right-0 bottom-24 md:bottom-6 z-40 pointer-events-none">
        {/* Same width and padding as the page column above. */}
        <div className="max-w-2xl mx-auto px-5 sm:px-8 pointer-events-auto">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={save}
            disabled={!included.length || saveMany.isPending}
            data-testid="save-all"
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-display font-bold shadow-xl shadow-primary/25 disabled:opacity-40 flex flex-col items-center leading-tight"
          >
            <span>{saveMany.isPending ? "Saving…" : included.length ? `Save ${included.length} ${included.length === 1 ? "expense" : "expenses"}` : "Nothing to save yet"}</span>
            {totalText && <span className="text-xs font-body font-medium opacity-80">{totalText}</span>}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default AddExpenses;
