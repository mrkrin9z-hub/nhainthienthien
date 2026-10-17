import path from "node:path";

import { onWorkers, shopKv } from "@/server/bindings";

const PREFIX = "product_photo:";
const MAX_BYTES = 2 * 1024 * 1024;

export function photoSlug(slug: string): string {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) throw new Error("Nhóm sản phẩm không hợp lệ.");
  return slug;
}

export async function writeProductPhoto(slug: string, bytes: Uint8Array, mime: string): Promise<void> {
  photoSlug(slug);
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw new Error("Chỉ nhận JPG, PNG hoặc WEBP.");
  if (bytes.byteLength > MAX_BYTES) throw new Error("Ảnh sản phẩm tối đa 2MB.");
  const kv = await shopKv();
  if (kv) {
    await kv.put(`${PREFIX}${slug}`, bytes);
    await kv.put(`${PREFIX}${slug}:mime`, mime);
    return;
  }
  if (onWorkers()) throw new Error("Chưa có KV để lưu ảnh sản phẩm.");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const dir = path.join(process.cwd(), "data", "product-photos");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, slug), bytes);
  await writeFile(path.join(dir, `${slug}.mime`), mime);
}

export async function readProductPhoto(slug: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  photoSlug(slug);
  const kv = await shopKv();
  if (kv) {
    const bytes = await kv.get(`${PREFIX}${slug}`, "arrayBuffer");
    if (!bytes) return null;
    const mime = (await kv.get(`${PREFIX}${slug}:mime`, "text")) || "image/jpeg";
    return { bytes: new Uint8Array(bytes), mime };
  }
  if (onWorkers()) return null;
  const { readFile } = await import("node:fs/promises");
  const dir = path.join(process.cwd(), "data", "product-photos");
  try {
    const bytes = new Uint8Array(await readFile(path.join(dir, slug)));
    const mime = (await readFile(path.join(dir, `${slug}.mime`), "utf8")).trim() || "image/jpeg";
    return { bytes, mime };
  } catch {
    return null;
  }
}

export async function clearProductPhoto(slug: string): Promise<void> {
  photoSlug(slug);
  const kv = await shopKv();
  if (kv) {
    await kv.delete(`${PREFIX}${slug}`);
    await kv.delete(`${PREFIX}${slug}:mime`);
    return;
  }
  if (onWorkers()) return;
  const { unlink } = await import("node:fs/promises");
  const dir = path.join(process.cwd(), "data", "product-photos");
  await unlink(path.join(dir, slug)).catch(() => undefined);
  await unlink(path.join(dir, `${slug}.mime`)).catch(() => undefined);
}
