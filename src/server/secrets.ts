import path from "node:path";

import { emptySecretStatus, INTEGRATION_PROVIDERS, type IntegrationProvider } from "@/domain/guard";
import { onWorkers, shopKv } from "@/server/bindings";

const SECRET_KEY = "integration_secrets";

type SecretMap = Partial<Record<IntegrationProvider, string>>;

function isProvider(value: string): value is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(value);
}

async function readMap(): Promise<SecretMap> {
  const kv = await shopKv();
  if (kv) {
    const raw = (await kv.get(SECRET_KEY, "json")) as SecretMap | null;
    return raw ?? {};
  }
  if (onWorkers()) return {};
  const { readFile } = await import("node:fs/promises");
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "data", "secrets.json"), "utf8")) as SecretMap;
  } catch {
    return {};
  }
}

async function writeMap(map: SecretMap): Promise<void> {
  const kv = await shopKv();
  if (kv) {
    await kv.put(SECRET_KEY, JSON.stringify(map));
    return;
  }
  if (onWorkers()) throw new Error("Chưa có KV để lưu khóa kết nối.");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const file = path.join(process.cwd(), "data", "secrets.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(map));
}

export async function integrationStatus(): Promise<Record<IntegrationProvider, boolean>> {
  const map = await readMap();
  const status = emptySecretStatus();
  for (const provider of INTEGRATION_PROVIDERS) status[provider] = Boolean(map[provider]);
  return status;
}

export async function saveIntegrationSecret(provider: string, value: string): Promise<void> {
  if (!isProvider(provider)) throw new Error("Kênh kết nối không có trong danh sách.");
  const map = await readMap();
  const trimmed = value.trim();
  if (!trimmed) delete map[provider];
  else map[provider] = trimmed;
  await writeMap(map);
}
