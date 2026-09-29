/**
 * Mock implementations of the Postgres functions (rpc) the app calls.
 * Each v2 migration that adds a function gets a matching handler here so the
 * screenshot runs keep working without a real database.
 */
import type { RpcHandler } from "./mock-supabase.ts";

const BUILTINS = ["food", "grocery", "rent", "subscriptions", "nightlife", "utilities", "selfcare", "travel"];

export const rpcHandlers: Record<string, RpcHandler> = {
  // 20260929120000_categories_2.sql
  delete_category: (tables, args) => {
    const category = String(args.p_category);
    const moveTo = (args.p_move_to as string | null) ?? null;
    const affected = tables.expenses.filter((e) => e.category === category);
    if (affected.length && !moveTo) throw new Error("This category still has expenses. Choose where to move them.");
    affected.forEach((e) => { e.category = moveTo; });
    const cats = tables.custom_categories;
    if (BUILTINS.includes(category)) {
      const r = cats.find((c) => c.builtin_key === category);
      if (r) r.hidden_at = new Date().toISOString();
    } else {
      tables.custom_categories = cats.filter((c) => c.id !== category);
    }
    return affected.length;
  },
};
