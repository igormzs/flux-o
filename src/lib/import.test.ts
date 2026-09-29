import { describe, it, expect } from "vitest";
import {
  detectDateOrder,
  detectDelimiter,
  draftErrors,
  draftToExpense,
  emptyDraft,
  guessCategory,
  markDuplicates,
  matchCategoryName,
  parseAmount,
  parseDate,
  parseText,
} from "./import";
import { DEFAULT_CATEGORIES, type CategoryInfo } from "./categories";

const now = new Date(2026, 8, 20, 10); // Sunday 20 Sep 2026
const ctx = { now, currency: "USD" };
const gym: CategoryInfo = { id: "gym-id", label: "Gym", icon: "Barbell", color: "#55a6f6", builtin: false, hidden: false };
const categories = [...DEFAULT_CATEGORIES, gym];

describe("Phase 2: amounts", () => {
  it.each([
    ["12.50", 12.5, null],
    ["3,50", 3.5, null],
    ["1.234,56", 1234.56, null],
    ["1,234.56", 1234.56, null],
    ["1,234", 1234, null],
    ["-€12.50", -12.5, "EUR"],
    ["(12.50)", -12.5, null],
    ["12.50 EUR", 12.5, "EUR"],
    ["R$ 30,00", 30, "BRL"],
    ["$5", 5, "USD"],
  ])("%s → %d %s", (raw, value, currency) => {
    expect(parseAmount(raw)).toEqual({ value, currency });
  });
  it("rejects text", () => {
    expect(parseAmount("coffee")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("Phase 2: dates", () => {
  it.each([
    ["2026-09-19", "2026-09-19"],
    ["19/09/2026", "2026-09-19"],
    ["19.09", "2026-09-19"],
    ["19 Sep", "2026-09-19"],
    ["Sep 19", "2026-09-19"],
    ["sat", "2026-09-19"],
    ["Saturday", "2026-09-19"],
    ["Fri", "2026-09-18"],
    ["sun", "2026-09-20"], // today is Sunday
    ["yesterday", "2026-09-19"],
    ["25/12", "2025-12-25"], // no year and in the future → last year
  ])("%s → %s", (raw, want) => {
    expect(parseDate(raw, now)).toBe(want);
  });
  it("follows the day/month order it's given", () => {
    expect(parseDate("9/19/26", now, "mdy")).toBe("2026-09-19");
    expect(parseDate("05/06/2026", now, "dmy")).toBe("2026-06-05");
    expect(parseDate("05/06/2026", now, "mdy")).toBe("2026-05-06");
  });
  it("rejects impossible dates and plain words", () => {
    expect(parseDate("31/02/2026", now)).toBeNull();
    expect(parseDate("dinner", now)).toBeNull();
  });
  it("detects day-first or month-first from the values", () => {
    expect(detectDateOrder(["19/09", "05/06"])).toBe("dmy");
    expect(detectDateOrder(["09/19/2026"])).toBe("mdy");
    expect(detectDateOrder(["05/06/2026"])).toBeNull();
  });
});

describe("Phase 2: notes, one expense per line", () => {
  const note = "Fri dinner with Ana 45\nSat groceries 62,30\nSun coffee € 3.50\n\n- Uber 12.40 EUR\nCinema tickets 18";
  const r = parseText(note, { ...ctx, defaultDate: "2026-09-17" });

  it("reads date, title, amount and currency from each line", () => {
    expect(r.format).toBe("lines");
    expect(r.drafts.map((d) => [d.date, d.title, d.amount, d.currency])).toEqual([
      ["2026-09-18", "Dinner with Ana", "45.00", "USD"],
      ["2026-09-19", "Groceries", "62.30", "USD"],
      ["2026-09-20", "Coffee", "3.50", "EUR"],
      ["2026-09-17", "Uber", "12.40", "EUR"],
      ["2026-09-17", "Cinema tickets", "18.00", "USD"],
    ]);
  });
  it("keeps a line without an amount so it can be completed", () => {
    expect(parseText("Parking", ctx).drafts[0]).toMatchObject({ title: "Parking", amount: "" });
  });
});

describe("Phase 2: tables and bank exports", () => {
  it("picks the delimiter that splits every line the same way", () => {
    expect(detectDelimiter("a;b;c\n1;2,5;3")).toBe(";");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter("Coffee 3,50\nLunch 12")).toBeNull();
  });

  it("reads a European bank statement and skips incoming money", () => {
    const csv = "Data;Descrição;Montante\n19/09/2026;LIDL LISBOA;-42,10\n18/09/2026;SALARIO;1.500,00\n17/09/2026;Uber *Trip;-12,40";
    const r = parseText(csv, ctx);
    expect(r.format).toBe("table");
    expect(r.skippedIncome).toBe(1);
    expect(r.drafts.map((d) => [d.date, d.title, d.amount])).toEqual([
      ["2026-09-19", "LIDL LISBOA", "42.10"],
      ["2026-09-17", "Uber *Trip", "12.40"],
    ]);
  });

  it("handles quoted fields, a category column and a currency column", () => {
    const csv = 'Date,Description,Amount,Category,Currency\n2026-09-19,"Dinner, with friends",45.00,Food,EUR';
    expect(parseText(csv, ctx).drafts[0]).toMatchObject({ title: "Dinner, with friends", amount: "45.00", category: "Food", categoryHint: "file", currency: "EUR" });
  });

  it("reads debit/credit columns and month-first dates", () => {
    const csv = "Date,Details,Debit,Credit\n09/18/2026,Coffee,3.50,\n09/19/2026,Refund,,20.00";
    const r = parseText(csv, ctx);
    expect(r.drafts.map((d) => [d.date, d.title, d.amount])).toEqual([["2026-09-18", "Coffee", "3.50"]]);
    expect(r.skippedIncome).toBe(1);
  });

  it("works out the columns of a file without a header", () => {
    const tsv = "2026-09-19\tSpotify\t9.99\n2026-09-18\tNetflix\t12.99";
    expect(parseText(tsv, ctx).drafts.map((d) => [d.date, d.title, d.amount])).toEqual([
      ["2026-09-19", "Spotify", "9.99"],
      ["2026-09-18", "Netflix", "12.99"],
    ]);
  });

  it("says when day and month can't be told apart", () => {
    expect(parseText("05/06/2026;Coffee;-3\n07/08/2026;Lunch;-12", ctx).ambiguousDates).toBe(true);
    expect(parseText("05/06/2026;Coffee;-3\n07/08/2026;Lunch;-12", { ...ctx, dateOrder: "mdy" }).drafts[0].date).toBe("2026-05-06");
  });
});

describe("Phase 2: categories", () => {
  const history = [{ title: "Lidl", category: "grocery" }, { title: "LIDL", category: "grocery" }, { title: "Lidl", category: "food" }];
  it("prefers what you used before for the same title", () => {
    expect(guessCategory("lidl", history, categories)).toEqual({ id: "grocery", hint: "history" });
  });
  it("then a category named in the title", () => {
    expect(guessCategory("Gym membership", [], categories)).toEqual({ id: "gym-id", hint: "name" });
  });
  it("then a keyword", () => {
    expect(guessCategory("Uber to airport", [], categories)).toEqual({ id: "travel", hint: "keyword" });
    expect(guessCategory("Netflix", [], categories)).toEqual({ id: "subscriptions", hint: "keyword" });
    expect(guessCategory("Something else", [], categories)).toBeNull();
  });
  it("never suggests a hidden category", () => {
    expect(guessCategory("Uber", [], categories.filter((c) => c.id !== "travel"))).toBeNull();
  });
  it("matches a file's category names", () => {
    expect(matchCategoryName("Groceries", categories)).toBe("grocery");
    expect(matchCategoryName("gym", categories)).toBe("gym-id");
    expect(matchCategoryName("Pets", categories)).toBe("");
  });
});

describe("Phase 2: duplicates", () => {
  const draft = (title: string, amount: string, date = "2026-09-19") => ({ ...emptyDraft(date, "USD", "grocery"), title, amount });
  it("unticks a draft that matches a saved expense", () => {
    const [d] = markDuplicates([draft("LIDL LISBOA", "42.10")], [{ title: "Lidl", amount: 42.1, date: "2026-09-19T12:00:00" }]);
    expect(d.include).toBe(false);
    expect(d.duplicate).toEqual({ title: "Lidl", date: "2026-09-19" });
  });
  it("unticks a line pasted twice", () => {
    const out = markDuplicates([draft("Coffee", "3.50"), draft("Coffee", "3,50")], []);
    expect(out.map((d) => d.include)).toEqual([true, false]);
  });
  it("keeps different amounts or days", () => {
    const out = markDuplicates([draft("Lidl", "42.11"), draft("Lidl", "42.10", "2026-09-18")], [{ title: "Lidl", amount: 42.1, date: "2026-09-19T12:00:00" }]);
    expect(out.every((d) => d.include)).toBe(true);
  });
});

describe("Phase 2: saving", () => {
  it("treats a carried-over category as a fallback", () => {
    expect(emptyDraft("2026-09-19", "USD", "food").categoryHint).toBe("carried");
    expect(emptyDraft("2026-09-19", "USD").categoryHint).toBeNull();
  });
  it("lists what's missing", () => {
    expect(draftErrors(emptyDraft("2026-09-19", "USD"))).toEqual(["Add a title", "Add an amount", "Pick a category"]);
  });
  it("saves at noon on the chosen day", () => {
    const e = draftToExpense({ ...emptyDraft("2026-09-19", "EUR", "food"), title: " Brunch ", amount: "12,50" });
    expect(e).toMatchObject({ title: "Brunch", amount: 12.5, currency: "EUR", category: "food" });
    expect(new Date(e.date).getHours()).toBe(12);
    expect(new Date(e.date).getDate()).toBe(19);
  });
});
