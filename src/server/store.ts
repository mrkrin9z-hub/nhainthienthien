import path from "node:path";

import { commitLoop } from "@/domain/commit";
import { buildSeed } from "@/domain/seed";
import type { ShopState } from "@/domain/types";
import { onWorkers, shopKv } from "@/server/bindings";

const SHOP_KEY = "shop_state";

let cached: ShopState | null = null;
let queue: Promise<void> = Promise.resolve();

export function usesSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function filePath(): string {
  return path.join(process.cwd(), "data", "shop.json");
}

type Where = "supabase" | "kv" | "file";

/** Supabase (đủ 2 biến) → KV SHOP_KV → file local. Workers không có hai cái đầu thì báo lỗi, không ghi đĩa. */
export async function persistence(): Promise<Where> {
  if (usesSupabase()) return "supabase";
  if (await shopKv()) return "kv";
  if (onWorkers()) {
    throw new Error(
      "Workers không ghi được file trên đĩa. Tạo KV binding SHOP_KV (xem README) hoặc đặt SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return "file";
}

export async function usesDisk(): Promise<boolean> {
  return (await persistence()) === "file";
}

async function supabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadFromDisk(): Promise<ShopState> {
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  try {
    const raw = await readFile(filePath(), "utf8");
    return JSON.parse(raw) as ShopState;
  } catch {
    const seed = await buildSeed();
    await mkdir(path.dirname(filePath()), { recursive: true });
    await writeFile(filePath(), JSON.stringify(seed));
    return seed;
  }
}

async function loadFromSupabase(): Promise<ShopState> {
  const supabase = await supabaseClient();
  const { data, error } = await supabase.from("shop_state").select("doc, version").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.doc) {
    const seed = await buildSeed();
    const inserted = await supabase.from("shop_state").insert({ id: 1, version: seed.version, doc: seed });
    if (inserted.error?.code === "23505") {
      const again = await supabase.from("shop_state").select("doc, version").eq("id", 1).single();
      if (again.error || !again.data?.doc) throw new Error(again.error?.message ?? "Không đọc được sổ.");
      return again.data.doc as ShopState;
    }
    if (inserted.error) throw new Error(inserted.error.message);
    return seed;
  }
  const doc = data.doc as ShopState;
  if (typeof data.version === "number") doc.version = data.version;
  return doc;
}

type KvDoc = { version?: number; doc?: ShopState };

async function loadFromKv(): Promise<ShopState> {
  const kv = await shopKv();
  if (!kv) throw new Error("Thiếu binding SHOP_KV.");
  const raw = (await kv.get(SHOP_KEY, "json")) as KvDoc | null;
  if (raw?.doc) {
    if (typeof raw.version === "number") raw.doc.version = raw.version;
    return raw.doc;
  }
  const seed = await buildSeed();
  const again = (await kv.get(SHOP_KEY, "json")) as KvDoc | null;
  if (again?.doc) {
    if (typeof again.version === "number") again.doc.version = again.version;
    return again.doc;
  }
  await kv.put(SHOP_KEY, JSON.stringify({ version: seed.version, doc: seed }));
  return seed;
}

async function writeIfVersion(state: ShopState, expected: number, where: Where): Promise<boolean> {
  if (where === "supabase") {
    const supabase = await supabaseClient();
    const { data, error } = await supabase
      .from("shop_state")
      .update({ version: state.version, doc: state, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .eq("version", expected)
      .select("id");
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  }
  if (where === "kv") {
    const kv = await shopKv();
    if (!kv) throw new Error("Thiếu binding SHOP_KV.");
    const raw = (await kv.get(SHOP_KEY, "json")) as KvDoc | null;
    const current = typeof raw?.version === "number" ? raw.version : raw?.doc?.version;
    if (raw && current !== expected) return false;
    await kv.put(SHOP_KEY, JSON.stringify({ version: state.version, doc: state }));
    return true;
  }
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  try {
    const current = JSON.parse(await readFile(filePath(), "utf8")) as ShopState;
    if (current.version !== expected) return false;
  } catch {
    // Chưa có file: lần ghi đầu.
  }
  await mkdir(path.dirname(filePath()), { recursive: true });
  await writeFile(filePath(), JSON.stringify(state));
  return true;
}

async function loadWhere(where: Where): Promise<ShopState> {
  if (where === "supabase") return loadFromSupabase();
  if (where === "kv") return loadFromKv();
  return loadFromDisk();
}

export async function readState(): Promise<ShopState> {
  const where = await persistence();
  if (where === "file" && cached) return structuredClone(cached);
  const state = await loadWhere(where);
  if (where === "file") cached = state;
  else cached = null;
  return structuredClone(state);
}

export async function mutate<T>(fn: (state: ShopState) => T | Promise<T>): Promise<T> {
  const run = queue.then(() =>
    commitLoop({
      read: async () => loadWhere(await persistence()),
      write: async (next, expected) => {
        const where = await persistence();
        const ok = await writeIfVersion(next, expected, where);
        if (ok && where === "file") cached = next;
        if (ok && where !== "file") cached = null;
        return ok;
      },
      run: fn,
    }),
  );
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
