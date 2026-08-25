import type { SupabaseClient } from "@supabase/supabase-js";

// A stand-in for the Supabase client, so the code that has to cope with a
// database answering badly can be tested against those answers.
//
// The real client builds a query by chaining methods and only runs it when
// it is awaited. This does the same: every method returns the chain, and
// awaiting it produces whatever answer the test asked for.

export type Answer = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null };

export type Call = { table: string | null; rpc: string | null; steps: { method: string; args: unknown[] }[] };

const CHAIN_METHODS = ["select", "insert", "update", "delete", "upsert", "eq", "neq", "is", "not", "in", "filter", "order", "limit", "range", "single", "maybeSingle", "returns"];

export function fakeSupabase(answer: (call: Call) => Answer) {
  const calls: Call[] = [];

  function chain(call: Call) {
    const target: Record<string, unknown> = {};
    for (const method of CHAIN_METHODS) {
      target[method] = (...args: unknown[]) => {
        call.steps.push({ method, args });
        return target;
      };
    }
    target.then = (onFulfilled?: (value: Answer) => unknown, onRejected?: (reason: unknown) => unknown) => {
      const result = answer(call);
      return Promise.resolve({ data: null, error: null, ...result }).then(onFulfilled, onRejected);
    };
    return target;
  }

  const client = {
    from(table: string) {
      const call: Call = { table, rpc: null, steps: [] };
      calls.push(call);
      return chain(call);
    },
    rpc(name: string, args: unknown) {
      const call: Call = { table: null, rpc: name, steps: [{ method: "rpc", args: [args] }] };
      calls.push(call);
      return chain(call);
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

// The arguments a chained call was given, for asserting on what was
// actually asked of the database.
export function argsOf(call: Call, method: string): unknown[] | undefined {
  return call.steps.find((s) => s.method === method)?.args;
}
