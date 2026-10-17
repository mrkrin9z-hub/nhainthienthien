/**
 * Binding Cloudflare. Trên Workers, `cloudflare:workers` có env thật.
 * Máy local (Vite) không có module này thì trả về rỗng — app ghi file.
 */

export type KvBinding = {
  get(key: string, type: "json"): Promise<unknown>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView): Promise<void>;
  delete(key: string): Promise<void>;
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
    return { SHOP_KV: g.SHOP_KV, ORDER_FILES: g.ORDER_FILES };
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
