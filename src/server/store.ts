import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildSeed } from "@/domain/seed";
import type { ShopState } from "@/domain/types";

let cached: ShopState | null = null;
let queue: Promise<void> = Promise.resolve();

function supabaseOn(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function filePath(): string {
  return path.join(process.cwd(), "data", "shop.json");
}

async function supabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadFromDisk(): Promise<ShopState> {
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
  const { data, error } = await supabase.from("shop_state").select("doc").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.doc) {
    const seed = await buildSeed();
    const inserted = await supabase.from("shop_state").insert({ id: 1, version: seed.version, doc: seed });
    if (inserted.error) throw new Error(inserted.error.message);
    return seed;
  }
  return data.doc as ShopState;
}

async function save(state: ShopState): Promise<void> {
  cached = structuredClone(state);
  if (supabaseOn()) {
    const supabase = await supabaseClient();
    const { error } = await supabase
      .from("shop_state")
      .upsert({ id: 1, version: state.version, doc: state, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return;
  }
  await mkdir(path.dirname(filePath()), { recursive: true });
  await writeFile(filePath(), JSON.stringify(state));
}

export async function readState(): Promise<ShopState> {
  if (cached) return structuredClone(cached);
  const state = supabaseOn() ? await loadFromSupabase() : await loadFromDisk();
  cached = state;
  return structuredClone(state);
}

export async function mutate<T>(fn: (state: ShopState) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const state = await readState();
    const result = await fn(state);
    state.version += 1;
    await save(state);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function dataFile(): string {
  return filePath();
}
