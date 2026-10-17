import path from "node:path";

import { commitLoop } from "@/domain/commit";
import { applyStoreMigrations } from "@/domain/migrate-shop";
import { backupFileName, backupKeyFromFile, backupKeysToDrop, dailyBackupKey, manualBackupKey, vnBackupDay } from "@/domain/guard";
import { buildSeed } from "@/domain/seed";
import type { ShopState } from "@/domain/types";
import { onWorkers, shopKv } from "@/server/bindings";

const SHOP_KEY = "shop_state";
const BACKUP_PREFIX = "shop_backup:";

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

async function loadRaw(where: Where): Promise<ShopState> {
  if (where === "supabase") return loadFromSupabase();
  if (where === "kv") return loadFromKv();
  return loadFromDisk();
}

/** Tắt Zalo của sổ cũ một lần, rồi ghi lại. Lần sau không đụng ô chủ đã chọn. */
async function loadWhere(where: Where): Promise<ShopState> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const state = await loadRaw(where);
    if (!applyStoreMigrations(state)) return state;
    const expected = state.version;
    state.version = expected + 1;
    if (await writeIfVersion(state, expected, where)) return state;
  }
  return loadRaw(where);
}

export async function readState(): Promise<ShopState> {
  const where = await persistence();
  if (where === "file" && cached) {
    void ensureDailyBackup(cached);
    return structuredClone(cached);
  }
  const state = await loadWhere(where);
  if (where === "file") cached = state;
  else cached = null;
  void ensureDailyBackup(state);
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
        if (ok) void ensureDailyBackup(next);
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

let backedUpDay = "";

function backupDir(): string {
  return path.join(process.cwd(), "data", "backups");
}

function backupPayload(state: ShopState): string {
  return JSON.stringify({ at: new Date().toISOString(), version: state.version, doc: state });
}

/** Ghi đè đúng một khóa. Không list trước khi ghi, vì list KV có thể chưa thấy bản vừa put. */
async function putBackup(key: string, state: ShopState): Promise<boolean> {
  const payload = backupPayload(state);
  const kv = await shopKv();
  if (kv) {
    await kv.put(key, payload);
    if (kv.list) {
      const all = await kv.list({ prefix: BACKUP_PREFIX });
      for (const drop of backupKeysToDrop((all.keys ?? []).map((item) => item.name))) {
        if (drop !== key) await kv.delete(drop);
      }
    }
    return true;
  }
  if (onWorkers()) return false;
  const { mkdir, readdir, writeFile, unlink } = await import("node:fs/promises");
  const dir = backupDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, backupFileName(key)), payload);
  const names = (await readdir(dir)).filter((name) => name.startsWith("shop_backup-") && name.endsWith(".json"));
  const keys = names.map((name) => backupKeyFromFile(name)).filter((item): item is string => Boolean(item));
  const drop = new Set(backupKeysToDrop(keys));
  for (const name of names) {
    const fileKey = backupKeyFromFile(name);
    if (fileKey && drop.has(fileKey)) await unlink(path.join(dir, name)).catch(() => undefined);
  }
  return true;
}

async function ensureDailyBackup(state: ShopState): Promise<void> {
  const day = vnBackupDay();
  if (backedUpDay === day) return;
  try {
    const saved = await putBackup(dailyBackupKey(), state);
    backedUpDay = saved ? day : "";
  } catch {
    backedUpDay = "";
  }
}

export async function writeManualBackup(state: ShopState): Promise<string> {
  const key = manualBackupKey();
  const saved = await putBackup(key, state);
  if (!saved) throw new Error("Chưa có chỗ lưu bản sao.");
  return key;
}

export type BackupEntry = { key: string; at: string };

export async function listBackups(): Promise<BackupEntry[]> {
  const kv = await shopKv();
  if (kv?.list) {
    const all = await kv.list({ prefix: BACKUP_PREFIX });
    const rows: BackupEntry[] = [];
    for (const item of all.keys ?? []) {
      const raw = await kv.get(item.name, "text");
      const at = raw ? ((JSON.parse(raw) as { at?: string }).at ?? item.name) : item.name;
      rows.push({ key: item.name, at });
    }
    return rows.sort((a, b) => b.key.localeCompare(a.key));
  }
  if (onWorkers()) return [];
  const { readdir, readFile } = await import("node:fs/promises");
  let names: string[] = [];
  try {
    names = await readdir(backupDir());
  } catch {
    return [];
  }
  const rows: BackupEntry[] = [];
  for (const name of names) {
    const key = backupKeyFromFile(name);
    if (!key) continue;
    try {
      const parsed = JSON.parse(await readFile(path.join(backupDir(), name), "utf8")) as { at?: string };
      rows.push({ key, at: parsed.at ?? key });
    } catch {
      rows.push({ key, at: key });
    }
  }
  return rows.sort((a, b) => b.key.localeCompare(a.key));
}

export async function readBackup(key: string): Promise<ShopState> {
  if (!key.startsWith(BACKUP_PREFIX) || key.includes("..")) throw new Error("Bản sao lưu không hợp lệ.");
  const kv = await shopKv();
  if (kv) {
    const raw = await kv.get(key, "text");
    if (!raw) throw new Error("Không thấy bản sao lưu.");
    const parsed = JSON.parse(raw) as { doc?: ShopState };
    if (!parsed.doc) throw new Error("Bản sao lưu hỏng.");
    return parsed.doc;
  }
  const { readFile } = await import("node:fs/promises");
  const name = backupFileName(key);
  const parsed = JSON.parse(await readFile(path.join(backupDir(), name), "utf8")) as { doc?: ShopState };
  if (!parsed.doc) throw new Error("Bản sao lưu hỏng.");
  return parsed.doc;
}
