/**
 * Binding Cloudflare. Trên Workers, `cloudflare:workers` có env thật.
 * Máy local (Vite) không có module này thì trả về rỗng — app ghi file.
 */

export type KvBinding = {
  get(key: string, type: "json"): Promise<unknown>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  get(key: string, type: "text"): Promise<string | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list?(options: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
};

export type AssetsKv = {
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  getWithMetadata?(
    key: string,
    type: "arrayBuffer",
  ): Promise<{ value: ArrayBuffer | null; metadata?: { contentType?: string } | null }>;
};

export type R2Binding = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<void>;
};

type CfEnv = {
  SHOP_KV?: KvBinding;
  ORDER_FILES?: R2Binding;
  ASSETS_KV?: AssetsKv;
  ASSETS?: { fetch?: (request: Request) => Promise<Response> };
};

let cached: CfEnv | null = null;

async function cloudflareEnv(): Promise<CfEnv> {
  if (cached) return cached;
  try {
    const specifier = "cloudflare:workers";
    const mod = (await import(/* @vite-ignore */ specifier)) as { env?: CfEnv };
    cached = mod.env ?? {};
    return cached;
  } catch {
    const g = globalThis as CfEnv;
    return { SHOP_KV: g.SHOP_KV, ORDER_FILES: g.ORDER_FILES, ASSETS_KV: g.ASSETS_KV, ASSETS: g.ASSETS };
  }
}

export function onWorkers(): boolean {
  const ua = globalThis.navigator?.userAgent ?? "";
  return ua.includes("Cloudflare-Workers");
}

export async function shopKv(): Promise<KvBinding | null> {
  const env = await cloudflareEnv();
  return env.SHOP_KV ?? null;
}

export async function orderFiles(): Promise<R2Binding | null> {
  const env = await cloudflareEnv();
  return env.ORDER_FILES ?? null;
}

/**
 * File tĩnh khi không có binding ASSETS.
 * Worker bọc ngoài chỉ gọi fetch(request), nên không đọc tham số env — lấy binding từ `cloudflare:workers`.
 */
export async function assetsKv(): Promise<AssetsKv | null> {
  const env = await cloudflareEnv();
  if (env.ASSETS) return null;
  return env.ASSETS_KV ?? null;
}
