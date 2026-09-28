/**
 * Mock implementations of the Postgres functions (rpc) the app calls.
 * Each v2 migration that adds a function gets a matching handler here so the
 * screenshot runs keep working without a real database.
 */
import type { RpcHandler } from "./mock-supabase.ts";

export const rpcHandlers: Record<string, RpcHandler> = {};
