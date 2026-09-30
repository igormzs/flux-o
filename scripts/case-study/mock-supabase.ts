/**
 * A tiny in-memory stand-in for the Supabase REST/Auth/Storage API, wired in
 * through Playwright request interception.
 *
 * The app is started with VITE_SUPABASE_URL pointing at MOCK_SUPABASE_URL, so
 * every request it makes is answered here. Production data is never touched,
 * no test account is needed, and every screenshot run sees the same data.
 *
 * Only the slice of PostgREST that supabase-js uses in this app is covered:
 * eq/neq/gt/gte/lt/lte/is/in filters, order, limit, single-object responses,
 * insert/upsert/update/delete with `return=representation`, and rpc stubs.
 */
import type { BrowserContext, Route } from "playwright";
import { DEMO_USER } from "./demo-data.ts";

export const MOCK_SUPABASE_URL = "https://demo.supabase.co";
export const MOCK_SUPABASE_KEY = "demo-anon-key";
/** supabase-js derives its storage key from the project ref (the first host label). */
export const MOCK_AUTH_STORAGE_KEY = "sb-demo-auth-token";
/** A 1×1 PNG, served for every signed image link. */
const TINY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
export type RpcHandler = (tables: Tables, args: Row) => unknown;

function b64url(obj: unknown) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/** A well-formed (unsigned) JWT so client-side decoding works. */
export function demoSession() {
  const exp = Math.floor(new Date("2099-01-01").getTime() / 1000);
  const access_token = [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({ sub: DEMO_USER.id, role: "authenticated", aud: "authenticated", exp, email: DEMO_USER.email }),
    "demo-signature",
  ].join(".");
  return {
    access_token,
    refresh_token: "demo-refresh-token",
    token_type: "bearer",
    expires_in: exp - Math.floor(Date.now() / 1000),
    expires_at: exp,
    user: DEMO_USER,
  };
}

function coerce(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return t;
    }
  }
  return v;
}

function matches(row: Row, col: string, expr: string): boolean {
  const dot = expr.indexOf(".");
  let op = expr.slice(0, dot);
  let val = expr.slice(dot + 1);
  let negate = false;
  if (op === "not") {
    negate = true;
    const d2 = val.indexOf(".");
    op = val.slice(0, d2);
    val = val.slice(d2 + 1);
  }
  const cell = row[col];
  let ok: boolean;
  switch (op) {
    case "eq": ok = String(cell) === val; break;
    case "neq": ok = String(cell) !== val; break;
    case "gt": ok = (coerce(cell) as number) > (coerce(val) as number); break;
    case "gte": ok = (coerce(cell) as number) >= (coerce(val) as number); break;
    case "lt": ok = (coerce(cell) as number) < (coerce(val) as number); break;
    case "lte": ok = (coerce(cell) as number) <= (coerce(val) as number); break;
    case "is": ok = val === "null" ? cell == null : String(cell) === val; break;
    case "in": {
      const list = val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, ""));
      ok = list.includes(String(cell));
      break;
    }
    case "ilike": {
      const re = new RegExp("^" + val.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*") + "$", "i");
      ok = re.test(String(cell ?? ""));
      break;
    }
    default: ok = true;
  }
  return negate ? !ok : ok;
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function applyQuery(rows: Row[], params: URLSearchParams) {
  let out = rows.filter((row) =>
    [...params.entries()].every(([k, v]) => RESERVED.has(k) || matches(row, k, v)),
  );
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((part) => {
      const [col, dir] = part.split(".");
      return { col, desc: dir === "desc" };
    });
    out = [...out].sort((a, b) => {
      for (const { col, desc } of keys) {
        const [x, y] = [coerce(a[col]), coerce(b[col])];
        if (x === y) continue;
        const cmp = (x as number) > (y as number) ? 1 : -1;
        return desc ? -cmp : cmp;
      }
      return 0;
    });
  }
  const offset = Number(params.get("offset") ?? 0);
  const limit = params.get("limit");
  return out.slice(offset, limit ? offset + Number(limit) : undefined);
}

function withDefaults(table: string, row: Row): Row {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...(table === "profiles" ? {} : { user_id: DEMO_USER.id }),
    created_at: now,
    ...(table === "expenses" ? { updated_at: now } : {}),
    ...(table === "recurring_expenses" ? { active: true, skipped: [], currency: null } : {}),
    ...row,
  };
}

/**
 * Route every request for MOCK_SUPABASE_URL to the in-memory tables.
 * `tables` is mutated by writes, so flows like "add expense" behave normally.
 */
export async function installMockSupabase(
  context: BrowserContext,
  tables: Tables,
  rpc: Record<string, RpcHandler> = {},
  /** Edge Functions by name: called with the JSON body, return the JSON response. */
  functions: Record<string, (body: Row) => Promise<unknown>> = {},
) {
  const json = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*", ...headers },
      body: body === undefined ? "" : JSON.stringify(body),
    });

  await context.route(`${MOCK_SUPABASE_URL}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();

    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
        },
      });
    }

    // ── Auth ──────────────────────────────────────────────
    if (url.pathname.startsWith("/auth/v1/")) {
      if (url.pathname.endsWith("/user")) return json(route, 200, DEMO_USER);
      if (url.pathname.endsWith("/token")) return json(route, 200, demoSession());
      if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204 });
      return json(route, 200, {});
    }

    // ── Storage ───────────────────────────────────────────
    if (url.pathname.startsWith("/storage/v1/")) {
      // Files live in `tables.storage` as { bucket, name } rows. Only signed
      // links serve a file: the bucket is private (like production).
      const files = (tables.storage ??= []);
      const rest = decodeURIComponent(url.pathname.slice("/storage/v1/object/".length));
      const [kind, bucket, ...parts] = rest.split("/");
      if (kind === "sign") {
        const name = parts.join("/");
        const exists = files.some((f) => f.bucket === bucket && f.name === name);
        if (method === "POST") {
          return exists
            ? json(route, 200, { signedURL: `/object/sign/${bucket}/${name}?token=demo` })
            : json(route, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
        }
        return exists ? route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG }) : route.fulfill({ status: 400 });
      }
      if (kind === "public") return route.fulfill({ status: 400, body: "Bucket not found" });
      if (kind === "list" && method === "POST") {
        const { prefix = "" } = req.postDataJSON() ?? {};
        const inFolder = files.filter((f) => f.bucket === bucket && f.name.startsWith(`${prefix}/`));
        return json(route, 200, inFolder.map((f) => ({ id: f.name, name: f.name.slice(prefix.length + 1) })));
      }
      if (method === "DELETE") {
        const { prefixes = [] } = req.postDataJSON() ?? {};
        const removed = files.filter((f) => kind === f.bucket && prefixes.includes(f.name));
        tables.storage = files.filter((f) => !removed.includes(f));
        return json(route, 200, removed.map((f) => ({ name: f.name, bucket_id: f.bucket })));
      }
      if (method === "POST" || method === "PUT") {
        const name = [bucket, ...parts].join("/");
        const i = files.findIndex((f) => f.bucket === kind && f.name === name);
        if (i !== -1) files.splice(i, 1);
        files.push({ bucket: kind, name });
        return json(route, 200, { Key: `${kind}/${name}` });
      }
      return route.fulfill({ status: 404 });
    }

    // ── Edge Functions ────────────────────────────────────
    const fnMatch = url.pathname.match(/^\/functions\/v1\/([\w-]+)/);
    if (fnMatch) {
      const fn = functions[fnMatch[1]];
      if (!fn) return json(route, 404, { error: `function ${fnMatch[1]} not mocked` });
      try {
        return json(route, 200, await fn(req.postDataJSON() ?? {}));
      } catch (err) {
        return json(route, 500, { error: (err as Error).message });
      }
    }

    // ── RPC ───────────────────────────────────────────────
    const rpcMatch = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)/);
    if (rpcMatch) {
      const handler = rpc[rpcMatch[1]];
      if (!handler) return json(route, 404, { message: `rpc ${rpcMatch[1]} not mocked` });
      try {
        return json(route, 200, handler(tables, req.postDataJSON() ?? {}) ?? null);
      } catch (err) {
        return json(route, 400, { code: "P0001", message: (err as Error).message });
      }
    }

    // ── Tables ────────────────────────────────────────────
    const tableMatch = url.pathname.match(/^\/rest\/v1\/(\w+)/);
    if (!tableMatch) return json(route, 404, { message: "not mocked" });
    const table = tableMatch[1];
    tables[table] ??= [];
    const rows = tables[table];
    const params = url.searchParams;
    const wantsObject = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const prefer = req.headers()["prefer"] ?? "";

    const respond = (result: Row[], status = 200) => {
      if (wantsObject) {
        if (result.length !== 1) {
          return json(route, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
        }
        return json(route, status, result[0]);
      }
      return json(route, status, result, { "content-range": `0-${Math.max(result.length - 1, 0)}/${result.length}` });
    };

    if (method === "HEAD") {
      const n = applyQuery(rows, params).length;
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range", "content-range": `*/${n}` } });
    }
    if (method === "GET") return respond(applyQuery(rows, params));

    if (method === "POST") {
      const body = req.postDataJSON();
      const incoming = (Array.isArray(body) ? body : [body]).map((r: Row) => withDefaults(table, r));
      const upsert = prefer.includes("resolution=merge-duplicates");
      const ignoreDuplicates = prefer.includes("resolution=ignore-duplicates");
      const conflictCols = (params.get("on_conflict") ?? "id").split(",");
      const written: Row[] = [];
      for (const row of incoming) {
        const existing = upsert || ignoreDuplicates
          ? rows.find((r) => conflictCols.every((c) => r[c] != null && r[c] === row[c]))
          : undefined;
        if (existing && ignoreDuplicates) continue;
        if (existing) {
          Object.assign(existing, row, { id: existing.id });
          written.push(existing);
        } else {
          rows.push(row);
          written.push(row);
        }
      }
      return prefer.includes("return=representation") ? respond(written, 201) : route.fulfill({ status: 201 });
    }

    if (method === "PATCH") {
      const patch = req.postDataJSON() as Row;
      const hit = applyQuery(rows, params);
      hit.forEach((r) => Object.assign(r, patch, table === "expenses" ? { updated_at: new Date().toISOString() } : {}));
      return prefer.includes("return=representation") ? respond(hit) : route.fulfill({ status: 204 });
    }

    if (method === "DELETE") {
      const hit = new Set(applyQuery(rows, params));
      tables[table] = rows.filter((r) => !hit.has(r));
      if (prefer.includes("return=representation")) return respond([...hit]);
      const counted = prefer.includes("count=exact")
        ? { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range", "content-range": `*/${hit.size}` }
        : undefined;
      return route.fulfill({ status: 204, headers: counted });
    }

    return json(route, 405, { message: "method not mocked" });
  });
}
